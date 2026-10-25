import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../../models/order.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import InventoryItem from "../../models/inventory-item.model";
import Customer from "../../models/customer.model";
import { RequestAccount } from "../../interfaces/request.interface";
import { readVietnameseNumber } from "../../helpers/number-to-words.helper";

interface OrderItemInput {
  productId: string;
  variantId: string;
  quantity: number | string;
  unitPrice: number | string;
  discount?: number | string;
  identifiers?: string[] | string;
}

const createOrderCode = (): string => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `HD-${date}-${Date.now().toString().slice(-5)}`;
};

/**
 * API Tìm kiếm sản phẩm / quét mã IMEI dùng cho màn hình POS
 * GET /admin/order/api/search-products?q=...
 */
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json({ code: "success", results: [] });
      return;
    }

    const qUpper = q.toUpperCase();

    // 1. Kiểm tra xem có quét trúng đích danh mã IMEI / Serial không
    const matchedDevice = await InventoryItem.findOne({
      identifier: qUpper,
      deleted: { $ne: true }
    })
      .populate("productId", "name slug inventoryType salePrice")
      .populate("variantId", "sku attributeValues salePriceOverride")
      .lean();

    if (matchedDevice) {
      const product = matchedDevice.productId as any;
      const variant = matchedDevice.variantId as any;

      if (matchedDevice.status !== "available") {
        res.json({
          code: "warning",
          message: `Thiết bị có mã IMEI "${qUpper}" hiện đang ở trạng thái "${matchedDevice.status}" (không thể bán)!`,
          deviceStatus: matchedDevice.status
        });
        return;
      }

      // Lấy toàn bộ các thiết bị đang có sẵn trong kho của biến thể này (bao gồm cả mã vừa quét và các mã khác)
      const availableItems = await InventoryItem.find({
        variantId: variant._id,
        status: "available",
        deleted: { $ne: true }
      })
        .select("identifier")
        .lean();

      const availableIdentifiers = availableItems.map((i) => i.identifier).filter(Boolean);
      const availableStock = availableItems.length;

      const unitPrice = variant?.salePriceOverride != null ? variant.salePriceOverride : (product?.salePrice || 0);

      res.json({
        code: "success",
        isDirectImeiMatch: true,
        matchedImei: qUpper,
        product: {
          _id: product._id,
          name: product.name,
          inventoryType: product.inventoryType
        },
        variant: {
          _id: variant._id,
          sku: variant.sku,
          attributeValues: variant.attributeValues || []
        },
        unitPrice,
        availableStock,
        availableIdentifiers
      });
      return;
    }

    // 2. Tìm kiếm theo tên sản phẩm hoặc mã SKU
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const matchedProducts = await Product.find({
      $or: [{ name: regex }, { sku: regex }],
      deleted: { $ne: true },
      status: "active"
    })
      .select("_id name slug inventoryType salePrice")
      .limit(20)
      .lean();

    const productIds = matchedProducts.map((p) => p._id);

    const variants = await ProductVariant.find({
      $or: [{ productId: { $in: productIds } }, { sku: regex }],
      status: "active"
    })
      .populate("productId", "name slug inventoryType salePrice status")
      .limit(30)
      .lean();

    const activeVariants = variants.filter((v: any) => v.productId && (v.productId as any).status === "active");
    const variantIds = activeVariants.map((v) => v._id);

    // Lấy tồn kho và danh sách IMEI có sẵn của các variant
    const availableItems = await InventoryItem.find({
      variantId: { $in: variantIds },
      status: "available",
      deleted: { $ne: true }
    })
      .select("variantId identifier quantity trackingType")
      .lean();

    const stockMap = new Map<string, { count: number; identifiers: string[] }>();
    for (const item of availableItems) {
      const vId = String(item.variantId);
      if (!stockMap.has(vId)) {
        stockMap.set(vId, { count: 0, identifiers: [] });
      }
      const entry = stockMap.get(vId)!;
      entry.count += Number(item.quantity) || 1;
      if (item.identifier) {
        entry.identifiers.push(item.identifier);
      }
    }

    const results = activeVariants.map((v: any) => {
      const p = v.productId as any;
      const vId = String(v._id);
      const stockInfo = stockMap.get(vId) || { count: 0, identifiers: [] };
      const unitPrice = v.salePriceOverride != null ? v.salePriceOverride : (p.salePrice || 0);

      return {
        productId: p._id,
        productName: p.name,
        inventoryType: p.inventoryType,
        variantId: v._id,
        variantSku: v.sku,
        attributeValues: v.attributeValues || [],
        unitPrice,
        availableStock: stockInfo.count,
        availableIdentifiers: stockInfo.identifiers
      };
    });

    // Sắp xếp: Sản phẩm CÒN HÀNG (availableStock > 0) lên trên đầu, HẾT HÀNG xếp xuống dưới cùng
    results.sort((a, b) => {
      if (a.availableStock > 0 && b.availableStock <= 0) return -1;
      if (a.availableStock <= 0 && b.availableStock > 0) return 1;
      return b.availableStock - a.availableStock;
    });

    res.json({
      code: "success",
      isDirectImeiMatch: false,
      results
    });
  } catch (error) {
    console.error("Error searchProducts:", error);
    res.status(500).json({ code: "error", message: "Lỗi tìm kiếm sản phẩm!" });
  }
};

/**
 * API Lấy danh sách IMEI có sẵn của 1 biến thể
 * GET /admin/order/api/available-imeis/:variantId
 */
export const availableImeis = async (req: Request, res: Response) => {
  try {
    const variantId = typeof req.params.variantId === "string" ? req.params.variantId : "";
    if (!mongoose.isValidObjectId(variantId)) {
      res.status(400).json({ code: "error", message: "Mã biến thể không hợp lệ!" });
      return;
    }

    const items = await InventoryItem.find({
      variantId: new mongoose.Types.ObjectId(variantId),
      status: "available",
      deleted: { $ne: true }
    })
      .select("identifier")
      .lean();

    const identifiers = items.map((i) => i.identifier).filter(Boolean);

    res.json({
      code: "success",
      identifiers
    });
  } catch (error) {
    console.error("Error availableImeis:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi lấy danh sách IMEI có sẵn!" });
  }
};

/**
 * API Tạo đơn hàng & xuất bán kho
 * POST /admin/order/create
 */
export const createPost = async (req: RequestAccount, res: Response) => {
  try {
    const customerInfo = req.body.customerInfo || {};
    const itemsInput: OrderItemInput[] = req.body.items || [];
    const paymentMethod = req.body.paymentMethod || "cash";
    const note = typeof req.body.note === "string" ? req.body.note.trim() : "";

    if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
      res.status(400).json({ code: "error", message: "Đơn hàng phải có ít nhất một sản phẩm!" });
      return;
    }

    const orderItems: any[] = [];
    let calculatedSubTotal = 0;
    const imeiToSellList: string[] = [];

    for (const rawItem of itemsInput) {
      if (!mongoose.isValidObjectId(rawItem.productId) || !mongoose.isValidObjectId(rawItem.variantId)) {
        res.status(400).json({ code: "error", message: "Thông tin sản phẩm hoặc biến thể không hợp lệ!" });
        return;
      }

      const [product, variant] = await Promise.all([
        Product.findOne({ _id: rawItem.productId, deleted: { $ne: true } }).lean(),
        ProductVariant.findOne({ _id: rawItem.variantId, productId: rawItem.productId }).lean()
      ]);

      if (!product || !variant) {
        res.status(400).json({ code: "error", message: "Sản phẩm hoặc biến thể không tồn tại trong hệ thống!" });
        return;
      }

      const quantity = Math.max(1, parseInt(String(rawItem.quantity), 10) || 1);
      const unitPrice = Math.max(0, parseFloat(String(rawItem.unitPrice)) || 0);
      const discount = Math.max(0, parseFloat(String(rawItem.discount)) || 0);
      const lineTotal = Math.max(0, quantity * unitPrice - discount);

      calculatedSubTotal += lineTotal;

      let rawIdentifiers: string[] = [];
      if (Array.isArray(rawItem.identifiers)) {
        rawIdentifiers = rawItem.identifiers;
      } else if (typeof rawItem.identifiers === "string" && rawItem.identifiers.trim()) {
        rawIdentifiers = rawItem.identifiers.split(/[\n,;]+/);
      }
      const identifiers = rawIdentifiers.map((id) => id.trim().toUpperCase()).filter(Boolean);

      // Nghiệp vụ kiểm tra IMEI/Serial với hàng định danh
      if (product.inventoryType === "imei" || product.inventoryType === "serial") {
        if (identifiers.length !== quantity) {
          res.status(400).json({
            code: "error",
            message: `Sản phẩm "${product.name}" yêu cầu chọn đủ ${quantity} mã ${product.inventoryType === "imei" ? "IMEI" : "Serial"} (hiện chọn: ${identifiers.length})!`
          });
          return;
        }

        // Kiểm tra xem các IMEI này có sẵn trong kho không
        const availableItems = await InventoryItem.find({
          variantId: variant._id,
          identifier: { $in: identifiers },
          status: "available",
          deleted: { $ne: true }
        }).lean();

        if (availableItems.length !== identifiers.length) {
          const foundIdentifiers = availableItems.map((i) => i.identifier);
          const missing = identifiers.filter((id) => !foundIdentifiers.includes(id));
          res.status(400).json({
            code: "error",
            message: `Mã ${missing.join(", ")} không còn có sẵn trong kho (đã bán hoặc đang bảo hành)!`
          });
          return;
        }

        imeiToSellList.push(...identifiers);
      } else {
        // Hàng số lượng: kiểm tra số lượng tồn kho khả dụng
        const availableCount = await InventoryItem.countDocuments({
          variantId: variant._id,
          status: "available",
          deleted: { $ne: true }
        });
        if (availableCount < quantity) {
          res.status(400).json({
            code: "error",
            message: `Sản phẩm "${product.name}" không đủ số lượng trong kho (còn ${availableCount}, yêu cầu ${quantity})!`
          });
          return;
        }
      }

      const variantAttributesText = (variant.attributeValues || []).map((a) => a.label).join(" / ");

      orderItems.push({
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        variantSku: variant.sku || "",
        variantName: variantAttributesText,
        trackingType: product.inventoryType,
        identifiers,
        quantity,
        unitPrice,
        discount,
        totalPrice: lineTotal
      });
    }

    const orderDiscount = Math.max(0, parseFloat(String(req.body.discount)) || 0);
    const totalAmount = Math.max(0, calculatedSubTotal - orderDiscount);
    const paidAmount = req.body.paidAmount != null ? Math.max(0, parseFloat(String(req.body.paidAmount))) : totalAmount;
    const changeAmount = Math.max(0, paidAmount - totalAmount);

    const orderCode = createOrderCode();

    // Tự động lưu / cập nhật hồ sơ khách hàng (Phương thức 1: Auto-upsert từ POS)
    let linkedCustomerId: mongoose.Types.ObjectId | undefined;
    const rawPhone = typeof customerInfo.phone === "string" ? customerInfo.phone.trim() : "";
    const cleanPhone = rawPhone.replace(/\D/g, "");

    if (cleanPhone.length >= 9) {
      let customer = await Customer.findOne({ phone: cleanPhone, deleted: { $ne: true } });
      const rawFullName = typeof customerInfo.fullName === "string" ? customerInfo.fullName.trim() : "";
      const validName = rawFullName && rawFullName !== "Khách lẻ vãng lai" ? rawFullName : "";
      const validAddress = typeof customerInfo.address === "string" ? customerInfo.address.trim() : "";

      if (customer) {
        customer.totalSpent = (customer.totalSpent || 0) + totalAmount;
        customer.orderCount = (customer.orderCount || 0) + 1;
        customer.lastOrderAt = new Date();
        if (validName && (!customer.fullName || customer.fullName === "Khách lẻ vãng lai" || customer.fullName === "Khách lẻ")) {
          customer.fullName = validName;
        }
        if (validAddress && !customer.address) {
          customer.address = validAddress;
        }
        await customer.save();
        linkedCustomerId = customer._id as mongoose.Types.ObjectId;
      } else {
        customer = await Customer.create({
          fullName: validName || "Khách lẻ",
          phone: cleanPhone,
          address: validAddress,
          totalSpent: totalAmount,
          orderCount: 1,
          lastOrderAt: new Date(),
          source: "pos",
          createdBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined
        });
        linkedCustomerId = customer._id as mongoose.Types.ObjectId;
      }
    }

    const order = await Order.create({
      orderCode,
      customerId: linkedCustomerId,
      customerInfo: {
        fullName: typeof customerInfo.fullName === "string" && customerInfo.fullName.trim() ? customerInfo.fullName.trim() : "Khách lẻ vãng lai",
        phone: cleanPhone || rawPhone,
        address: typeof customerInfo.address === "string" ? customerInfo.address.trim() : ""
      },
      items: orderItems,
      subTotal: calculatedSubTotal,
      discount: orderDiscount,
      totalAmount,
      paymentMethod,
      paidAmount,
      changeAmount,
      orderStatus: "completed",
      note,
      createdBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined
    });

    // Cập nhật trạng thái các thiết bị IMEI/Serial sang "sold"
    if (imeiToSellList.length > 0) {
      const itemsToUpdate = await InventoryItem.find({
        identifier: { $in: imeiToSellList },
        status: "available"
      });

      for (const item of itemsToUpdate) {
        const fromStatus = item.status;
        item.status = "sold";
        item.statusLogs.push({
          fromStatus,
          toStatus: "sold",
          reason: `Bán lẻ theo hóa đơn ${orderCode}`,
          note: customerInfo.phone ? `Khách hàng: ${order.customerInfo?.fullName || "Khách lẻ"} (${customerInfo.phone})` : "Khách lẻ",
          updatedBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined,
          updatedAt: new Date()
        });
        await item.save();
      }
    }

    res.json({
      code: "success",
      message: `Tạo đơn hàng ${orderCode} thành công!`,
      orderId: order._id,
      orderCode: order.orderCode
    });
  } catch (error) {
    console.error("Error createPost order:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi tạo đơn hàng!" });
  }
};

/**
 * Hủy đơn hàng và hoàn trả thiết bị về kho
 * PATCH /admin/order/cancel/:id
 */
export const cancel = async (req: RequestAccount, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const cancelReason = typeof req.body.cancelReason === "string" ? req.body.cancelReason.trim() : "Khách hủy đơn hàng";

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID đơn hàng không hợp lệ!" });
      return;
    }

    const order = await Order.findOne({ _id: id, deleted: { $ne: true } });
    if (!order) {
      res.status(404).json({ code: "error", message: "Đơn hàng không tồn tại!" });
      return;
    }

    if (order.orderStatus === "cancelled") {
      res.status(400).json({ code: "error", message: "Đơn hàng này đã bị hủy trước đó!" });
      return;
    }

    order.orderStatus = "cancelled";
    order.cancelReason = cancelReason;
    order.cancelledAt = new Date();
    if (req.adminId && mongoose.isValidObjectId(req.adminId)) {
      order.cancelledBy = new mongoose.Types.ObjectId(req.adminId);
    }

    await order.save();

    // Giảm trừ tích lũy chi tiêu của khách hàng nếu đơn bị hủy
    if (order.customerId) {
      const customer = await Customer.findById(order.customerId);
      if (customer) {
        customer.totalSpent = Math.max(0, (customer.totalSpent || 0) - order.totalAmount);
        customer.orderCount = Math.max(0, (customer.orderCount || 0) - 1);
        await customer.save();
      }
    }

    // Thu thập toàn bộ IMEI trong đơn để hoàn về kho
    const soldIdentifiers: string[] = [];
    for (const item of order.items) {
      if (item.identifiers && item.identifiers.length) {
        soldIdentifiers.push(...item.identifiers);
      }
    }

    if (soldIdentifiers.length > 0) {
      const itemsToRevert = await InventoryItem.find({
        identifier: { $in: soldIdentifiers },
        status: "sold"
      });

      for (const item of itemsToRevert) {
        const fromStatus = item.status;
        item.status = "available";
        item.statusLogs.push({
          fromStatus,
          toStatus: "available",
          reason: `Hủy đơn hàng ${order.orderCode}: ${cancelReason}`,
          updatedBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined,
          updatedAt: new Date()
        });
        await item.save();
      }
    }

    res.json({
      code: "success",
      message: `Đã hủy đơn hàng ${order.orderCode} và hoàn trả ${soldIdentifiers.length} thiết bị về kho!`
    });
  } catch (error) {
    console.error("Error cancel order:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi hủy đơn hàng!" });
  }
};

/**
 * Giao diện Bán hàng POS
 * GET /admin/order/pos
 */
export const pos = async (_req: Request, res: Response) => {
  res.render("admin/order/pos", {
    pageTitle: "Bán hàng tại quầy (POS)"
  });
};

/**
 * Danh sách đơn hàng
 * GET /admin/order
 */
export const list = async (req: Request, res: Response) => {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
  const paymentMethod = typeof req.query.paymentMethod === "string" ? req.query.paymentMethod : "";
  const orderStatus = typeof req.query.orderStatus === "string" ? req.query.orderStatus : "";
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";

  const find: Record<string, unknown> = { deleted: { $ne: true } };

  if (["completed", "cancelled"].includes(orderStatus)) {
    find.orderStatus = orderStatus;
  }
  if (["cash", "bank_transfer", "credit_card", "installment"].includes(paymentMethod)) {
    find.paymentMethod = paymentMethod;
  }
  if (from || to) {
    const createdAtQuery: Record<string, Date> = {};
    if (from) createdAtQuery.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) createdAtQuery.$lte = new Date(`${to}T23:59:59.999Z`);
    find.createdAt = createdAtQuery;
  }

  if (keyword) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    find.$or = [
      { orderCode: regex },
      { "customerInfo.fullName": regex },
      { "customerInfo.phone": regex },
      { "items.identifiers": regex.source.toUpperCase() }
    ];
  }

  const [orders, totalOrders, completedCount, cancelledCount, revenueAgg] = await Promise.all([
    Order.find(find)
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Order.countDocuments({ deleted: { $ne: true } }),
    Order.countDocuments({ deleted: { $ne: true }, orderStatus: "completed" }),
    Order.countDocuments({ deleted: { $ne: true }, orderStatus: "cancelled" }),
    Order.aggregate([
      { $match: { deleted: { $ne: true }, orderStatus: "completed" } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } }
    ])
  ]);

  const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

  res.render("admin/order/list", {
    pageTitle: "Quản lý đơn hàng",
    orders,
    stats: { totalOrders, completedCount, cancelledCount, totalRevenue },
    filters: { keyword, paymentMethod, orderStatus, from, to },
    canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("order:write")
  });
};

/**
 * Chi tiết đơn hàng & In hóa đơn
 * GET /admin/order/:id
 */
export const detail = async (req: Request, res: Response) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!mongoose.isValidObjectId(id)) {
    res.redirect("/admin/order");
    return;
  }

  const order = await Order.findOne({ _id: id, deleted: { $ne: true } })
    .populate("createdBy", "fullName email")
    .populate("cancelledBy", "fullName email")
    .lean();

  if (!order) {
    res.redirect("/admin/order");
    return;
  }

  res.render("admin/order/detail", {
    pageTitle: `Hóa đơn: ${order.orderCode}`,
    order,
    totalInWords: readVietnameseNumber(order.totalAmount || 0)
  });
};
