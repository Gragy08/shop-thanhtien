import { Request, Response } from "express";
import mongoose from "mongoose";
import WarrantyTicket, { WarrantyStatus } from "../../models/warranty-ticket.model";
import InventoryItem from "../../models/inventory-item.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import Order from "../../models/order.model";
import Customer from "../../models/customer.model";
import { RequestAccount } from "../../interfaces/request.interface";
import { syncCustomerOrdersByPhone } from "./customer.controller";

const createTicketCode = (): string => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `BH-${date}-${Date.now().toString().slice(-5)}`;
};

/**
 * API Kiểm tra thiết bị & Tra cứu lịch sử mua để tự động điền form bảo hành
 * GET /admin/warranty/api/check-device?query=...
 */
export const checkDevice = async (req: Request, res: Response) => {
  try {
    const rawQuery = typeof req.query.query === "string" ? req.query.query.trim() : "";
    if (!rawQuery) {
      res.json({ code: "success", found: false, message: "Vui lòng nhập IMEI hoặc SĐT cần tra cứu!" });
      return;
    }

    const queryUpper = rawQuery.toUpperCase();
    const cleanPhone = rawQuery.replace(/\D/g, "");

    // 1. Tra cứu theo IMEI / Serial thiết bị
    const inventoryItem = await InventoryItem.findOne({
      identifier: queryUpper,
      deleted: { $ne: true }
    })
      .populate("productId", "name slug inventoryType salePrice")
      .populate("variantId", "sku attributeValues salePriceOverride")
      .lean();

    if (inventoryItem) {
      const product = inventoryItem.productId as any;
      const variant = inventoryItem.variantId as any;

      // Tìm đơn hàng đã xuất bán thiết bị này (nếu có)
      const order = await Order.findOne({
        "items.identifiers": queryUpper,
        deleted: { $ne: true }
      })
        .sort({ createdAt: -1 })
        .lean();

      // Kiểm tra thời hạn bảo hành (mặc định 12 tháng từ ngày mua trên hóa đơn)
      const purchaseDate = order ? order.createdAt : inventoryItem.createdAt;
      const expiryDate = new Date(purchaseDate);
      expiryDate.setMonth(expiryDate.getMonth() + 12);
      const isUnderWarranty = new Date() <= expiryDate;

      // Thông tin khách hàng
      let customerData: any = null;
      if (order && order.customerId) {
        customerData = await Customer.findById(order.customerId).lean();
      } else if (order && order.customerInfo?.phone) {
        customerData = await Customer.findOne({
          phone: order.customerInfo.phone.replace(/\D/g, ""),
          deleted: { $ne: true }
        }).lean();
      }

      res.json({
        code: "success",
        found: true,
        type: "imei",
        device: {
          inventoryItemId: inventoryItem._id,
          identifier: inventoryItem.identifier,
          deviceStatus: inventoryItem.status,
          productId: product?._id,
          productName: product?.name || "Thiết bị không xác định",
          variantId: variant?._id,
          variantSku: variant?.sku || "",
          variantName: (variant?.attributeValues || []).map((a: any) => a.label).join(" / ")
        },
        order: order ? {
          orderId: order._id,
          orderCode: order.orderCode,
          purchaseDate: order.createdAt
        } : null,
        customer: customerData ? {
          customerId: customerData._id,
          fullName: customerData.fullName,
          phone: customerData.phone,
          address: customerData.address
        } : (order?.customerInfo ? {
          fullName: order.customerInfo.fullName,
          phone: order.customerInfo.phone,
          address: order.customerInfo.address
        } : null),
        warrantyInfo: {
          purchaseDate,
          expiryDate,
          isUnderWarranty,
          periodMonths: 12
        }
      });
      return;
    }

    // 2. Tra cứu theo SĐT khách hàng
    if (cleanPhone.length >= 9) {
      const customer = await Customer.findOne({
        phone: cleanPhone,
        deleted: { $ne: true }
      }).lean();

      if (customer) {
        // Tìm các đơn hàng của khách hàng này để gợi ý các máy khách đã mua
        const orders = await Order.find({
          $or: [
            { customerId: customer._id },
            { "customerInfo.phone": cleanPhone }
          ],
          deleted: { $ne: true }
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        const devices: any[] = [];
        for (const ord of orders) {
          for (const item of ord.items) {
            if (item.identifiers && item.identifiers.length > 0) {
              for (const id of item.identifiers) {
                devices.push({
                  identifier: id,
                  productName: item.productName,
                  variantName: item.variantName,
                  orderCode: ord.orderCode,
                  purchaseDate: ord.createdAt
                });
              }
            }
          }
        }

        res.json({
          code: "success",
          found: true,
          type: "phone",
          customer: {
            customerId: customer._id,
            fullName: customer.fullName,
            phone: customer.phone,
            address: customer.address
          },
          devices
        });
        return;
      }
    }

    res.json({
      code: "success",
      found: false,
      message: `Không tìm thấy thiết bị hoặc khách hàng nào với thông tin "${rawQuery}"!`
    });
  } catch (error) {
    console.error("Error checkDevice:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi tra cứu thiết bị!" });
  }
};

/**
 * Tạo phiếu tiếp nhận bảo hành mới
 * POST /admin/warranty/create
 */
export const createPost = async (req: RequestAccount, res: Response) => {
  try {
    const identifier = typeof req.body.identifier === "string" ? req.body.identifier.trim().toUpperCase() : "";
    const issueDescription = typeof req.body.issueDescription === "string" ? req.body.issueDescription.trim() : "";
    const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const rawPhone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
    const physicalCondition = typeof req.body.physicalCondition === "string" ? req.body.physicalCondition.trim() : "Máy bình thường";
    const accessoriesAttached = typeof req.body.accessoriesAttached === "string" ? req.body.accessoriesAttached.trim() : "Thân máy";
    const passcode = typeof req.body.passcode === "string" ? req.body.passcode.trim() : "";
    const isUnderWarranty = req.body.isUnderWarranty === true || req.body.isUnderWarranty === "true";
    const repairCost = Math.max(0, parseFloat(String(req.body.repairCost)) || 0);
    const expectedReturnDate = req.body.expectedReturnDate ? new Date(req.body.expectedReturnDate) : undefined;
    const technicianNotes = typeof req.body.technicianNotes === "string" ? req.body.technicianNotes.trim() : "";

    if (!identifier) {
      res.status(400).json({ code: "error", message: "Mã IMEI/Serial thiết bị không được để trống!" });
      return;
    }

    if (!issueDescription) {
      res.status(400).json({ code: "error", message: "Mô tả tình trạng lỗi của máy không được để trống!" });
      return;
    }

    if (!fullName || !cleanPhone) {
      res.status(400).json({ code: "error", message: "Họ tên và số điện thoại khách hàng không được để trống!" });
      return;
    }

    // 1. Kiểm tra thiết bị trong kho
    const inventoryItem = await InventoryItem.findOne({
      identifier,
      deleted: { $ne: true }
    })
      .populate("productId", "name")
      .populate("variantId", "sku attributeValues");

    let productName = typeof req.body.productName === "string" ? req.body.productName.trim() : "";
    let variantName = typeof req.body.variantName === "string" ? req.body.variantName.trim() : "";

    if (inventoryItem) {
      const product = inventoryItem.productId as any;
      const variant = inventoryItem.variantId as any;
      productName = product?.name || productName || "Thiết bị chính hãng";
      variantName = (variant?.attributeValues || []).map((a: any) => a.label).join(" / ") || variantName;
    } else {
      if (!productName) productName = "Thiết bị ngoài cửa hàng";
    }

    // 2. Tự động kiểm tra/lưu khách hàng (Auto-upsert Customer)
    let linkedCustomerId: mongoose.Types.ObjectId | undefined;
    if (cleanPhone.length >= 9) {
      let customer = await Customer.findOne({ phone: cleanPhone, deleted: { $ne: true } });
      if (customer) {
        if (!customer.address && address) {
          customer.address = address;
          await customer.save();
        }
        linkedCustomerId = customer._id as mongoose.Types.ObjectId;
      } else {
        customer = await Customer.create({
          fullName,
          phone: cleanPhone,
          address,
          source: "warranty",
          createdBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined
        });
        linkedCustomerId = customer._id as mongoose.Types.ObjectId;
      }
    }

    // 3. Tìm thông tin đơn hàng đã bán (nếu có)
    const order = await Order.findOne({
      "items.identifiers": identifier,
      deleted: { $ne: true }
    }).sort({ createdAt: -1 });

    // ĐỒNG BỘ NẾU TRƯỚC ĐÂY BÁN CHO KHÁCH VÃNG LAI:
    // Nếu đơn hàng gốc trước đó chưa có customerId hoặc chưa có SĐT,
    // khi khách mang máy đến bảo hành và để lại thông tin -> Hệ thống tự động liên kết đơn hàng này
    // vào hồ sơ khách hàng mới và cập nhật lại tổng chi tiêu, số lượng đơn mua!
    if (order && linkedCustomerId) {
      let orderUpdated = false;
      if (!order.customerId) {
        order.customerId = linkedCustomerId;
        orderUpdated = true;
      }
      if (!order.customerInfo?.phone || !order.customerInfo.phone.trim()) {
        if (!order.customerInfo) {
          order.customerInfo = { fullName, phone: cleanPhone, address };
        } else {
          order.customerInfo.phone = cleanPhone;
          if (!order.customerInfo.fullName || order.customerInfo.fullName === "Khách lẻ vãng lai") {
            order.customerInfo.fullName = fullName;
          }
          if (!order.customerInfo.address && address) {
            order.customerInfo.address = address;
          }
        }
        orderUpdated = true;
      }
      if (orderUpdated) {
        await order.save();
        await syncCustomerOrdersByPhone(cleanPhone, linkedCustomerId);
      }
    }

    const ticketCode = createTicketCode();

    const ticket = await WarrantyTicket.create({
      ticketCode,
      customerId: linkedCustomerId,
      customerInfo: {
        fullName,
        phone: cleanPhone,
        address
      },
      inventoryItemId: inventoryItem ? inventoryItem._id : undefined,
      identifier,
      productId: inventoryItem ? (inventoryItem.productId as any)?._id : undefined,
      variantId: inventoryItem ? (inventoryItem.variantId as any)?._id : undefined,
      productName,
      variantName,
      orderId: order ? order._id : undefined,
      orderCode: order ? order.orderCode : "",
      purchaseDate: order ? order.createdAt : (inventoryItem ? inventoryItem.createdAt : new Date()),
      isUnderWarranty,
      issueDescription,
      physicalCondition,
      accessoriesAttached,
      passcode,
      technicianNotes,
      repairCost,
      ticketStatus: "received",
      receivedDate: new Date(),
      expectedReturnDate,
      createdBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined
    });

    // 4. QUY TẮC KHO: Chuyển trạng thái IMEI từ "sold" -> "warranty" (nếu có trong kho)
    if (inventoryItem) {
      const fromStatus = inventoryItem.status;
      inventoryItem.status = "warranty";
      inventoryItem.statusLogs.push({
        fromStatus,
        toStatus: "warranty",
        reason: `Tiếp nhận bảo hành theo phiếu ${ticketCode}: ${issueDescription}`,
        note: `Khách hàng: ${fullName} (${cleanPhone})`,
        updatedBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined,
        updatedAt: new Date()
      });
      await inventoryItem.save();
    }

    res.json({
      code: "success",
      message: `Lập phiếu bảo hành ${ticketCode} thành công!`,
      ticketId: ticket._id,
      ticketCode: ticket.ticketCode
    });
  } catch (error) {
    console.error("Error createPost warranty:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi tạo phiếu bảo hành!" });
  }
};

/**
 * Cập nhật tiến độ / trạng thái phiếu bảo hành & Điều chuyển kho thiết bị
 * PATCH /admin/warranty/update-status/:id
 */
export const updateStatus = async (req: RequestAccount, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const nextStatus = req.body.ticketStatus as WarrantyStatus;
    const technicianNotes = typeof req.body.technicianNotes === "string" ? req.body.technicianNotes.trim() : "";
    const repairCost = req.body.repairCost != null ? Math.max(0, parseFloat(String(req.body.repairCost))) : undefined;
    const cancelReason = typeof req.body.cancelReason === "string" ? req.body.cancelReason.trim() : "";

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID phiếu bảo hành không hợp lệ!" });
      return;
    }

    const ticket = await WarrantyTicket.findOne({ _id: id, deleted: { $ne: true } });
    if (!ticket) {
      res.status(404).json({ code: "error", message: "Phiếu bảo hành không tồn tại!" });
      return;
    }

    const validStatuses: WarrantyStatus[] = ["received", "in_progress", "completed", "delivered", "cancelled"];
    if (!validStatuses.includes(nextStatus)) {
      res.status(400).json({ code: "error", message: "Trạng thái bảo hành không hợp lệ!" });
      return;
    }

    const oldStatus = ticket.ticketStatus;
    ticket.ticketStatus = nextStatus;

    if (technicianNotes) ticket.technicianNotes = technicianNotes;
    if (repairCost != null) ticket.repairCost = repairCost;

    if (req.adminId && mongoose.isValidObjectId(req.adminId)) {
      ticket.updatedBy = new mongoose.Types.ObjectId(req.adminId);
    }

    // Ghi nhận mốc thời gian theo trạng thái
    if (nextStatus === "completed") {
      ticket.completedDate = new Date();
    } else if (nextStatus === "delivered") {
      ticket.deliveredDate = new Date();
    } else if (nextStatus === "cancelled") {
      ticket.cancelledDate = new Date();
      ticket.cancelReason = cancelReason || "Hủy phiếu bảo hành";
    }

    await ticket.save();

    // ĐIỀU CHUYỂN KHO THIẾT BỊ:
    // Khi bàn giao trả máy khách ("delivered") hoặc Hủy ("cancelled"):
    // Chuyển thiết bị từ "warranty" -> "sold"
    if ((nextStatus === "delivered" || nextStatus === "cancelled") && oldStatus !== "delivered") {
      const inventoryItem = await InventoryItem.findOne({
        identifier: ticket.identifier,
        deleted: { $ne: true }
      });

      if (inventoryItem && inventoryItem.status === "warranty") {
        const fromStatus = inventoryItem.status;
        inventoryItem.status = "sold";
        inventoryItem.statusLogs.push({
          fromStatus,
          toStatus: "sold",
          reason: nextStatus === "delivered"
            ? `Bàn giao trả máy bảo hành cho khách theo phiếu ${ticket.ticketCode}`
            : `Hủy phiếu bảo hành ${ticket.ticketCode}, trả máy về trạng thái đã bán`,
          note: `Khách hàng: ${ticket.customerInfo.fullName} (${ticket.customerInfo.phone})`,
          updatedBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined,
          updatedAt: new Date()
        });
        await inventoryItem.save();
      }
    }

    res.json({
      code: "success",
      message: `Cập nhật trạng thái phiếu bảo hành ${ticket.ticketCode} thành công!`
    });
  } catch (error) {
    console.error("Error updateStatus warranty:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi cập nhật trạng thái bảo hành!" });
  }
};

/**
 * Cập nhật trạng thái hàng loạt cho nhiều phiếu bảo hành
 * PATCH /admin/warranty/bulk-update-status
 */
export const bulkUpdateStatus = async (req: RequestAccount, res: Response) => {
  try {
    const ticketIds = Array.isArray(req.body.ticketIds) ? req.body.ticketIds : [];
    const nextStatus = req.body.ticketStatus as WarrantyStatus;
    const technicianNotes = typeof req.body.technicianNotes === "string" ? req.body.technicianNotes.trim() : "";

    if (!ticketIds.length) {
      res.status(400).json({ code: "error", message: "Vui lòng chọn ít nhất một phiếu bảo hành!" });
      return;
    }

    const validStatuses: WarrantyStatus[] = ["received", "in_progress", "completed", "delivered", "cancelled"];
    if (!validStatuses.includes(nextStatus)) {
      res.status(400).json({ code: "error", message: "Trạng thái bảo hành không hợp lệ!" });
      return;
    }

    const validObjectIds = ticketIds.filter((id: string) => mongoose.isValidObjectId(id));
    if (!validObjectIds.length) {
      res.status(400).json({ code: "error", message: "Danh sách mã phiếu không hợp lệ!" });
      return;
    }

    const tickets = await WarrantyTicket.find({
      _id: { $in: validObjectIds },
      deleted: { $ne: true }
    });

    let updatedCount = 0;
    const adminObjId = req.adminId && mongoose.isValidObjectId(req.adminId) ? new mongoose.Types.ObjectId(req.adminId) : undefined;

    for (const ticket of tickets) {
      const oldStatus = ticket.ticketStatus;
      if (oldStatus === nextStatus) continue;

      ticket.ticketStatus = nextStatus;
      if (technicianNotes) {
        ticket.technicianNotes = ticket.technicianNotes
          ? `${ticket.technicianNotes} | ${technicianNotes}`
          : technicianNotes;
      }
      if (adminObjId) ticket.updatedBy = adminObjId;

      if (nextStatus === "completed") {
        ticket.completedDate = new Date();
      } else if (nextStatus === "delivered") {
        ticket.deliveredDate = new Date();
      } else if (nextStatus === "cancelled") {
        ticket.cancelledDate = new Date();
        ticket.cancelReason = "Cập nhật hàng loạt từ danh sách";
      }

      await ticket.save();
      updatedCount++;

      // Điều chuyển kho thiết bị: khi bàn giao hoặc hủy, trả từ warranty -> sold
      if ((nextStatus === "delivered" || nextStatus === "cancelled") && oldStatus !== "delivered") {
        const inventoryItem = await InventoryItem.findOne({
          identifier: ticket.identifier,
          deleted: { $ne: true }
        });

        if (inventoryItem && inventoryItem.status === "warranty") {
          const fromStatus = inventoryItem.status;
          inventoryItem.status = "sold";
          inventoryItem.statusLogs.push({
            fromStatus,
            toStatus: "sold",
            reason: nextStatus === "delivered"
              ? `Bàn giao trả máy bảo hành cho khách (cập nhật hàng loạt theo phiếu ${ticket.ticketCode})`
              : `Hủy phiếu bảo hành ${ticket.ticketCode}, trả máy về trạng thái đã bán`,
            note: `Khách hàng: ${ticket.customerInfo.fullName} (${ticket.customerInfo.phone})`,
            updatedBy: adminObjId,
            updatedAt: new Date()
          });
          await inventoryItem.save();
        }
      }
    }

    res.json({
      code: "success",
      message: `Đã cập nhật trạng thái cho ${updatedCount} phiếu bảo hành thành công!`
    });
  } catch (error) {
    console.error("Error bulkUpdateStatus:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi cập nhật trạng thái hàng loạt!" });
  }
};

/**
 * Danh sách phiếu bảo hành
 * GET /admin/warranty
 */
export const list = async (req: Request, res: Response) => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    const ticketStatus = typeof req.query.ticketStatus === "string" ? req.query.ticketStatus : "";
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";

    const find: Record<string, unknown> = { deleted: { $ne: true } };

    if (["received", "in_progress", "completed", "delivered", "cancelled"].includes(ticketStatus)) {
      find.ticketStatus = ticketStatus;
    }

    if (from || to) {
      const dateQuery: Record<string, Date> = {};
      if (from) dateQuery.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) dateQuery.$lte = new Date(`${to}T23:59:59.999Z`);
      find.receivedDate = dateQuery;
    }

    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      find.$or = [
        { ticketCode: regex },
        { identifier: regex },
        { "customerInfo.fullName": regex },
        { "customerInfo.phone": regex },
        { orderCode: regex }
      ];
    }

    const [tickets, totalTickets, receivedCount, inProgressCount, completedCount, deliveredCount] = await Promise.all([
      WarrantyTicket.find(find)
        .populate("createdBy", "fullName email")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      WarrantyTicket.countDocuments({ deleted: { $ne: true } }),
      WarrantyTicket.countDocuments({ deleted: { $ne: true }, ticketStatus: "received" }),
      WarrantyTicket.countDocuments({ deleted: { $ne: true }, ticketStatus: "in_progress" }),
      WarrantyTicket.countDocuments({ deleted: { $ne: true }, ticketStatus: "completed" }),
      WarrantyTicket.countDocuments({ deleted: { $ne: true }, ticketStatus: "delivered" })
    ]);

    res.render("admin/warranty/list", {
      pageTitle: "Quản lý bảo hành & sửa chữa",
      tickets,
      stats: { totalTickets, receivedCount, inProgressCount, completedCount, deliveredCount },
      filters: { keyword, ticketStatus, from, to },
      canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("warranty:write")
    });
  } catch (error) {
    console.error("Error warranty list:", error);
    res.status(500).render("error/500", { message: "Lỗi tải danh sách phiếu bảo hành!" });
  }
};

/**
 * Trang lập phiếu bảo hành mới (Bước 4.3)
 * GET /admin/warranty/create
 */
export const create = async (_req: Request, res: Response) => {
  res.render("admin/warranty/create", {
    pageTitle: "Lập phiếu tiếp nhận bảo hành"
  });
};

/**
 * Chi tiết phiếu bảo hành & In phiếu hẹn
 * GET /admin/warranty/:id
 */
export const detail = async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!mongoose.isValidObjectId(id)) {
      res.redirect("/admin/warranty");
      return;
    }

    const ticket = await WarrantyTicket.findOne({ _id: id, deleted: { $ne: true } })
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email")
      .lean();

    if (!ticket) {
      res.redirect("/admin/warranty");
      return;
    }

    res.render("admin/warranty/detail", {
      pageTitle: `Phiếu bảo hành: ${ticket.ticketCode}`,
      ticket,
      canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("warranty:write")
    });
  } catch (error) {
    console.error("Error warranty detail:", error);
    res.redirect("/admin/warranty");
  }
};

/**
 * Bàn giao trả máy cho khách hàng & Chốt kết quả xử lý
 * POST /admin/warranty/deliver/:id
 */
export const deliver = async (req: RequestAccount, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "Mã phiếu bảo hành không hợp lệ!" });
      return;
    }

    const ticket = await WarrantyTicket.findOne({ _id: id, deleted: { $ne: true } });
    if (!ticket) {
      res.status(404).json({ code: "error", message: "Phiếu bảo hành không tồn tại!" });
      return;
    }

    const resolution = typeof req.body.resolution === "string" ? req.body.resolution.trim() : "repair";
    const replacedParts = typeof req.body.replacedParts === "string" ? req.body.replacedParts.trim() : "";
    const partsWarrantyMonths = Math.max(0, parseInt(String(req.body.partsWarrantyMonths)) || 0);
    const repairCost = Math.max(0, parseFloat(String(req.body.repairCost)) || 0);
    const paymentMethod = typeof req.body.paymentMethod === "string" ? req.body.paymentMethod.trim() : "free";
    const handoverNotes = typeof req.body.handoverNotes === "string" ? req.body.handoverNotes.trim() : "";
    const technicianNotes = typeof req.body.technicianNotes === "string" ? req.body.technicianNotes.trim() : "";

    ticket.ticketStatus = "delivered";
    ticket.deliveredDate = new Date();
    ticket.resolution = resolution;
    ticket.replacedParts = replacedParts;
    ticket.partsWarrantyMonths = partsWarrantyMonths;
    ticket.repairCost = repairCost;
    ticket.paymentMethod = paymentMethod;
    ticket.handoverNotes = handoverNotes;
    if (technicianNotes) ticket.technicianNotes = technicianNotes;
    if (req.adminId && mongoose.isValidObjectId(req.adminId)) {
      ticket.updatedBy = new mongoose.Types.ObjectId(req.adminId);
    }

    await ticket.save();

    // Điều chuyển kho thiết bị: chuyển từ warranty -> sold
    if (ticket.inventoryItemId) {
      const inventoryItem = await InventoryItem.findOne({
        _id: ticket.inventoryItemId,
        deleted: { $ne: true }
      });

      if (inventoryItem && inventoryItem.status === "warranty") {
        const fromStatus = inventoryItem.status;
        inventoryItem.status = "sold";
        inventoryItem.statusLogs.push({
          fromStatus,
          toStatus: "sold",
          reason: `Bàn giao trả máy bảo hành cho khách (${resolution}): Phiếu ${ticket.ticketCode}`,
          note: `Khách nhận: ${ticket.customerInfo.fullName} (${ticket.customerInfo.phone}) | ${handoverNotes || "Đã test máy hoàn chỉnh"}`,
          updatedBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined,
          updatedAt: new Date()
        });
        await inventoryItem.save();
      }
    }

    res.json({
      code: "success",
      message: `Bàn giao trả máy thành công theo phiếu ${ticket.ticketCode}!`,
      ticketId: ticket._id
    });
  } catch (error) {
    console.error("Error deliver warranty:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi bàn giao trả máy!" });
  }
};

/**
 * API Tìm kiếm các IMEI có sẵn trong kho để đổi mới 1-đổi-1
 * GET /admin/warranty/api/search-available-imei?keyword=...
 */
export const searchAvailableImei = async (req: Request, res: Response) => {
  try {
    const rawKeyword = typeof req.query.keyword === "string" ? req.query.keyword.trim().toUpperCase() : "";
    const variantId = typeof req.query.variantId === "string" ? req.query.variantId.trim() : "";

    const query: Record<string, unknown> = {
      status: "available",
      deleted: { $ne: true }
    };

    if (variantId && mongoose.isValidObjectId(variantId)) {
      query.variantId = new mongoose.Types.ObjectId(variantId);
    }

    if (rawKeyword) {
      query.identifier = new RegExp(rawKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }

    const items = await InventoryItem.find(query)
      .populate("productId", "name")
      .populate("variantId", "sku attributeValues salePriceOverride")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const results = items.map((it: any) => {
      const prod = it.productId;
      const vr = it.variantId;
      const variantName = (vr?.attributeValues || []).map((a: any) => a.label).join(" / ");
      return {
        inventoryItemId: it._id,
        identifier: it.identifier,
        productId: prod?._id,
        productName: prod?.name || "",
        variantId: vr?._id,
        variantSku: vr?.sku || "",
        variantName: variantName || "Mặc định",
        status: it.status
      };
    });

    res.json({
      code: "success",
      items: results
    });
  } catch (error) {
    console.error("Error searchAvailableImei:", error);
    res.status(500).json({ code: "error", message: "Lỗi tra cứu IMEI sẵn có!" });
  }
};

/**
 * Nghiệp vụ Đổi mới 1-đổi-1 cho thiết bị lỗi phần cứng
 * POST /admin/warranty/exchange-1to1/:id
 */
export const exchange1to1 = async (req: RequestAccount, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const replacementImei = typeof req.body.replacementImei === "string" ? req.body.replacementImei.trim().toUpperCase() : "";
    const exchangeReason = typeof req.body.exchangeReason === "string" ? req.body.exchangeReason.trim() : "Lỗi phần cứng trong thời gian đổi mới";
    const priceDifference = parseFloat(String(req.body.priceDifference)) || 0;
    const handoverNotes = typeof req.body.handoverNotes === "string" ? req.body.handoverNotes.trim() : "";

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "Mã phiếu bảo hành không hợp lệ!" });
      return;
    }

    if (!replacementImei) {
      res.status(400).json({ code: "error", message: "Vui lòng chọn hoặc quét mã IMEI mới để đổi cho khách!" });
      return;
    }

    const ticket = await WarrantyTicket.findOne({ _id: id, deleted: { $ne: true } });
    if (!ticket) {
      res.status(404).json({ code: "error", message: "Phiếu bảo hành không tồn tại!" });
      return;
    }

    if (ticket.identifier === replacementImei) {
      res.status(400).json({ code: "error", message: "Mã IMEI mới không được trùng với mã IMEI cũ đang bảo hành!" });
      return;
    }

    // 1. Kiểm tra IMEI mới trong kho: Phải tồn tại và đang ở trạng thái "available"
    const newInventoryItem = await InventoryItem.findOne({
      identifier: replacementImei,
      deleted: { $ne: true }
    })
      .populate("productId", "name")
      .populate("variantId", "sku attributeValues");

    if (!newInventoryItem) {
      res.status(400).json({ code: "error", message: `Mã IMEI mới "${replacementImei}" không tồn tại trong kho!` });
      return;
    }

    if (newInventoryItem.status !== "available") {
      res.status(400).json({
        code: "error",
        message: `Thiết bị IMEI "${replacementImei}" đang ở trạng thái "${newInventoryItem.status}", không thể xuất đổi!`
      });
      return;
    }

    const adminObjId = req.adminId && mongoose.isValidObjectId(req.adminId) ? new mongoose.Types.ObjectId(req.adminId) : undefined;
    const newProd = newInventoryItem.productId as any;
    const newVr = newInventoryItem.variantId as any;
    const newVariantName = (newVr?.attributeValues || []).map((a: any) => a.label).join(" / ");

    // 2. ĐIỀU CHUYỂN KHO THIẾT BỊ MỚI: available -> sold
    newInventoryItem.status = "sold";
    newInventoryItem.statusLogs.push({
      fromStatus: "available",
      toStatus: "sold",
      reason: `Xuất đổi máy mới 1-đổi-1 cho khách hàng ${ticket.customerInfo.fullName} (thay cho IMEI cũ ${ticket.identifier}) theo phiếu ${ticket.ticketCode}`,
      note: `Lý do: ${exchangeReason}`,
      updatedBy: adminObjId,
      updatedAt: new Date()
    });
    await newInventoryItem.save();

    // 3. THU HỒI THIẾT BỊ CŨ: chuyển sang damaged (hàng lỗi phần cứng)
    if (ticket.inventoryItemId) {
      const oldInventoryItem = await InventoryItem.findOne({
        _id: ticket.inventoryItemId,
        deleted: { $ne: true }
      });

      if (oldInventoryItem) {
        const fromStatus = oldInventoryItem.status;
        oldInventoryItem.status = "damaged";
        oldInventoryItem.statusLogs.push({
          fromStatus,
          toStatus: "damaged",
          reason: `Thu hồi máy lỗi phần cứng đổi mới 1-đổi-1 theo phiếu ${ticket.ticketCode} (Đã xuất đổi sang IMEI mới: ${replacementImei})`,
          note: `Lỗi máy: ${ticket.issueDescription} | Lý do: ${exchangeReason}`,
          updatedBy: adminObjId,
          updatedAt: new Date()
        });
        await oldInventoryItem.save();
      }
    }

    // 4. CẬP NHẬT ĐƠN HÀNG GỐC (NẾU CÓ): Thay thế IMEI cũ bằng IMEI mới trong items
    if (ticket.orderId) {
      const order = await Order.findOne({ _id: ticket.orderId, deleted: { $ne: true } });
      if (order) {
        let orderChanged = false;
        for (const it of order.items) {
          if (it.identifiers && it.identifiers.includes(ticket.identifier)) {
            // Thay thế IMEI cũ bằng IMEI mới
            it.identifiers = it.identifiers.map((imei) => (imei === ticket.identifier ? replacementImei : imei));
            orderChanged = true;
          }
        }
        if (orderChanged) {
          const noteText = `[Đổi 1-đổi-1: Thay thế IMEI ${ticket.identifier} bằng IMEI ${replacementImei} theo phiếu ${ticket.ticketCode}]`;
          order.note = order.note ? `${order.note} | ${noteText}` : noteText;
          await order.save();
        }
      }
    }

    // 5. CẬP NHẬT PHIẾU BẢO HÀNH
    ticket.isExchange1to1 = true;
    ticket.replacementInventoryItemId = newInventoryItem._id as mongoose.Types.ObjectId;
    ticket.replacementIdentifier = replacementImei;
    ticket.replacementProductName = newProd?.name || ticket.productName;
    ticket.replacementVariantName = newVariantName || ticket.variantName;
    ticket.priceDifference = priceDifference;
    ticket.resolution = "exchange_1to1";
    ticket.ticketStatus = "delivered";
    ticket.deliveredDate = new Date();
    ticket.handoverNotes = handoverNotes || `Đã xuất đổi máy mới 100% (IMEI: ${replacementImei}) cho khách hàng.`;
    if (adminObjId) ticket.updatedBy = adminObjId;

    await ticket.save();

    res.json({
      code: "success",
      message: `Đổi mới 1-đổi-1 thành công! Đã xuất IMEI mới "${replacementImei}" và thu hồi IMEI lỗi "${ticket.identifier}".`,
      ticketId: ticket._id
    });
  } catch (error) {
    console.error("Error exchange1to1:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi thực hiện đổi máy 1-đổi-1!" });
  }
};

/**
 * Trang tra cứu bảo hành công khai (Dành cho khách lẻ tra cứu trực tuyến)
 * GET /tra-cuu-bao-hanh
 */
export const publicLookupPage = async (req: Request, res: Response) => {
  try {
    const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
    let lookupResult: any = null;

    if (rawQuery) {
      const queryUpper = rawQuery.toUpperCase();
      const cleanPhone = rawQuery.replace(/\D/g, "");

      // 1. Tìm thông tin thiết bị theo IMEI
      const item = await InventoryItem.findOne({
        identifier: queryUpper,
        deleted: { $ne: true }
      })
        .populate("productId", "name")
        .populate("variantId", "sku attributeValues")
        .lean();

      // 2. Tìm đơn hàng
      const order = await Order.findOne({
        $or: [
          { "items.identifiers": queryUpper },
          cleanPhone ? { "customerInfo.phone": cleanPhone } : null
        ].filter(Boolean) as any[],
        deleted: { $ne: true }
      })
        .sort({ createdAt: -1 })
        .lean();

      // 3. Tìm các phiếu bảo hành liên quan
      const tickets = await WarrantyTicket.find({
        $or: [
          { identifier: queryUpper },
          cleanPhone ? { "customerInfo.phone": cleanPhone } : null
        ].filter(Boolean) as any[],
        deleted: { $ne: true }
      })
        .sort({ createdAt: -1 })
        .lean();

      if (item || order || (tickets && tickets.length > 0)) {
        const prod = item ? (item.productId as any) : null;
        const vr = item ? (item.variantId as any) : null;
        const purchaseDate = order ? order.createdAt : (item ? item.createdAt : null);

        let expiryDate: Date | null = null;
        let daysLeft = 0;
        let isUnderWarranty = false;

        if (purchaseDate) {
          expiryDate = new Date(purchaseDate);
          expiryDate.setMonth(expiryDate.getMonth() + 12);
          const now = new Date();
          isUnderWarranty = now <= expiryDate;
          if (isUnderWarranty) {
            daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        lookupResult = {
          found: true,
          query: rawQuery,
          productName: prod?.name || order?.items?.[0]?.productName || tickets?.[0]?.productName || "Thiết bị di động",
          variantName: (vr?.attributeValues || []).map((a: any) => a.label).join(" / ") || order?.items?.[0]?.variantName || "",
          identifier: item?.identifier || queryUpper,
          orderCode: order?.orderCode || "",
          purchaseDate,
          expiryDate,
          daysLeft,
          isUnderWarranty,
          tickets: tickets || []
        };
      } else {
        lookupResult = {
          found: false,
          query: rawQuery,
          message: `Không tìm thấy thông tin bảo hành cho mã "${rawQuery}". Quý khách vui lòng kiểm tra lại IMEI hoặc liên hệ hotline cửa hàng.`
        };
      }
    }

    res.render("client/warranty-lookup", {
      pageTitle: "Tra cứu thời hạn & Tiến độ bảo hành thiết bị - Shop Thanh Tiền",
      query: rawQuery,
      result: lookupResult
    });
  } catch (error) {
    console.error("Error publicLookupPage:", error);
    res.render("client/warranty-lookup", {
      pageTitle: "Tra cứu bảo hành - Shop Thanh Tiền",
      query: "",
      result: null
    });
  }
};

