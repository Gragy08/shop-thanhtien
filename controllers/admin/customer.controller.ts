import { Request, Response } from "express";
import mongoose from "mongoose";
import Customer from "../../models/customer.model";
import Order from "../../models/order.model";
import { RequestAccount } from "../../interfaces/request.interface";
import { parseVNDate } from "../../helpers/date.helper";
import { buildPagination } from "../../helpers/pagination.helper";

/**
 * API Tra cứu nhanh khách hàng theo số điện thoại (Dùng cho POS và Bảo hành)
 * GET /admin/customer/api/lookup?phone=...
 */
export const lookup = async (req: Request, res: Response) => {
  try {
    const rawPhone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";
    const cleanPhone = rawPhone.replace(/\D/g, "");

    if (!cleanPhone || cleanPhone.length < 9) {
      res.json({ code: "success", found: false, message: "Số điện thoại chưa đủ độ dài." });
      return;
    }

    const customer = await Customer.findOne({
      phone: cleanPhone,
      deleted: { $ne: true }
    })
      .select("_id fullName phone cccd address email totalSpent orderCount customerGroup lastOrderAt")
      .lean();

    if (!customer) {
      res.json({ code: "success", found: false });
      return;
    }

    res.json({
      code: "success",
      found: true,
      customer
    });
  } catch (error) {
    console.error("Error customer lookup:", error);
    res.status(500).json({ code: "error", message: "Lỗi tra cứu khách hàng!" });
  }
};

/**
 * Hàm đồng bộ dữ liệu: Quét toàn bộ đơn hàng trong quá khứ có cùng số điện thoại,
 * tính toán lại chuẩn xác totalSpent, orderCount, lastOrderAt và gán customerId cho đơn hàng.
 */
export const syncCustomerOrdersByPhone = async (phone: string, customerId?: mongoose.Types.ObjectId | string) => {
  if (!phone) return null;
  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone) return null;

  const customer = customerId
    ? await Customer.findById(customerId)
    : await Customer.findOne({ phone: cleanPhone, deleted: { $ne: true } });

  if (!customer) return null;

  const orders = await Order.find({
    $or: [
      { customerId: customer._id },
      { "customerInfo.phone": cleanPhone }
    ],
    deleted: { $ne: true }
  });

  let actualSpent = 0;
  let actualCount = 0;
  let latestDate: Date | undefined = customer.lastOrderAt;

  for (const ord of orders) {
    if (ord.orderStatus === "completed") {
      actualSpent += (ord.totalAmount || 0);
      actualCount += 1;
      if (!latestDate || ord.createdAt > latestDate) {
        latestDate = ord.createdAt;
      }
    }
    // Gán customerId cho đơn hàng nếu chưa có
    if (!ord.customerId || String(ord.customerId) !== String(customer._id)) {
      ord.customerId = customer._id as mongoose.Types.ObjectId;
      await ord.save();
    }
  }

  customer.totalSpent = actualSpent;
  customer.orderCount = actualCount;
  if (latestDate) customer.lastOrderAt = latestDate;
  await customer.save();

  return customer;
};

/**
 * Danh sách khách hàng
 * GET /admin/customer
 */
export const list = async (req: Request, res: Response) => {
  try {
    // Tự động quét và đồng bộ các đơn hàng lịch sử có cùng SĐT vào hồ sơ khách hàng
    const distinctPhones = await Order.distinct("customerInfo.phone", {
      "customerInfo.phone": { $exists: true, $ne: "" },
      deleted: { $ne: true }
    });
    for (const p of distinctPhones) {
      if (typeof p === "string" && p.trim()) {
        await syncCustomerOrdersByPhone(p);
      }
    }

    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    const customerGroup = typeof req.query.customerGroup === "string" ? req.query.customerGroup : "";
    const source = typeof req.query.source === "string" ? req.query.source : "";

    const find: Record<string, unknown> = { deleted: { $ne: true } };

    if (["retail", "vip", "wholesale"].includes(customerGroup)) {
      find.customerGroup = customerGroup;
    }
    if (["pos", "manual", "warranty"].includes(source)) {
      find.source = source;
    }

    if (keyword) {
      const cleanPhoneKeyword = keyword.replace(/\D/g, "");
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      
      const orConditions: any[] = [
        { fullName: regex },
        { email: regex },
        { address: regex }
      ];

      if (cleanPhoneKeyword) {
        orConditions.push({ phone: new RegExp(cleanPhoneKeyword) });
      }

      find.$or = orConditions;
    }

    const [filteredCustomerCount, totalCustomers, totalOrdersAgg, totalSpentAgg] = await Promise.all([
      Customer.countDocuments(find),
      Customer.countDocuments({ deleted: { $ne: true } }),
      Customer.aggregate([
        { $match: { deleted: { $ne: true } } },
        { $group: { _id: null, totalOrders: { $sum: "$orderCount" } } }
      ]),
      Customer.aggregate([
        { $match: { deleted: { $ne: true } } },
        { $group: { _id: null, totalSpent: { $sum: "$totalSpent" } } }
      ])
    ]);

    const pagination = buildPagination(req, filteredCustomerCount, 10);
    const customers = await Customer.find(find)
      .populate("createdBy", "fullName email")
      .sort({ updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();

    const totalOrders = totalOrdersAgg.length > 0 ? totalOrdersAgg[0].totalOrders : 0;
    const totalSpent = totalSpentAgg.length > 0 ? totalSpentAgg[0].totalSpent : 0;

    res.render("admin/customer/list", {
      pageTitle: "Quản lý khách hàng",
      customers,
      stats: { totalCustomers, totalOrders, totalSpent },
      filters: { keyword, customerGroup, source },
      pagination,
      canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("customer:write"),
      canDelete: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("customer:delete")
    });
  } catch (error) {
    console.error("Error customer list:", error);
    res.status(500).render("error/500", { message: "Lỗi tải danh sách khách hàng!" });
  }
};

/**
 * Trang tạo khách hàng mới thủ công (Phương thức 2)
 * GET /admin/customer/create
 */
export const create = async (_req: Request, res: Response) => {
  res.render("admin/customer/create", {
    pageTitle: "Thêm mới khách hàng"
  });
};

/**
 * Xử lý tạo mới khách hàng bằng tay (Phương thức 2 - Kiểm tra chống trùng SĐT)
 * POST /admin/customer/create
 */
export const createPost = async (req: RequestAccount, res: Response) => {
  try {
    const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const rawPhone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
    const notes = typeof req.body.notes === "string" ? req.body.notes.trim() : "";
    const customerGroup = req.body.customerGroup || "retail";
    const gender = req.body.gender || "other";
    const birthday = req.body.birthday ? (parseVNDate(req.body.birthday, false) || undefined) : undefined;

    if (!fullName) {
      res.status(400).json({ code: "error", message: "Họ và tên khách hàng không được để trống!" });
      return;
    }

    if (!cleanPhone || cleanPhone.length < 9) {
      res.status(400).json({ code: "error", message: "Số điện thoại không hợp lệ (tối thiểu 9-10 chữ số)!" });
      return;
    }

    // Kiểm tra chống trùng số điện thoại (Anti-conflict validation)
    const existing = await Customer.findOne({
      phone: cleanPhone,
      deleted: { $ne: true }
    });

    if (existing) {
      res.status(400).json({
        code: "duplicate_phone",
        message: `Số điện thoại "${cleanPhone}" đã tồn tại trong hệ thống (gắn với khách hàng: ${existing.fullName}). Không thể tạo trùng lặp!`,
        existingCustomerId: existing._id
      });
      return;
    }

    const customer = await Customer.create({
      fullName,
      phone: cleanPhone,
      email,
      address,
      birthday,
      gender,
      customerGroup,
      notes,
      source: "manual",
      createdBy: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined
    });

    // Tự động quét và liên kết toàn bộ đơn hàng trong quá khứ có cùng số điện thoại
    await syncCustomerOrdersByPhone(cleanPhone, customer._id);

    res.json({
      code: "success",
      message: `Tạo khách hàng "${customer.fullName}" thành công!`,
      customerId: customer._id
    });
  } catch (error) {
    console.error("Error customer createPost:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi tạo khách hàng!" });
  }
};

/**
 * Trang chỉnh sửa thông tin khách hàng
 * GET /admin/customer/edit/:id
 */
export const edit = async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!mongoose.isValidObjectId(id)) {
      res.redirect("/admin/customer");
      return;
    }

    const customer = await Customer.findOne({ _id: id, deleted: { $ne: true } }).lean();
    if (!customer) {
      res.redirect("/admin/customer");
      return;
    }

    res.render("admin/customer/edit", {
      pageTitle: `Chỉnh sửa: ${customer.fullName}`,
      customer
    });
  } catch (error) {
    console.error("Error customer edit:", error);
    res.redirect("/admin/customer");
  }
};

/**
 * Xử lý cập nhật thông tin khách hàng
 * PATCH /admin/customer/edit/:id
 */
export const editPatch = async (req: RequestAccount, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID khách hàng không hợp lệ!" });
      return;
    }

    const customer = await Customer.findOne({ _id: id, deleted: { $ne: true } });
    if (!customer) {
      res.status(404).json({ code: "error", message: "Khách hàng không tồn tại!" });
      return;
    }

    const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const rawPhone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
    const notes = typeof req.body.notes === "string" ? req.body.notes.trim() : "";
    const customerGroup = req.body.customerGroup || "retail";
    const gender = req.body.gender || "other";
    const birthday = req.body.birthday ? (parseVNDate(req.body.birthday, false) || undefined) : undefined;

    if (!fullName) {
      res.status(400).json({ code: "error", message: "Họ và tên khách hàng không được để trống!" });
      return;
    }

    if (!cleanPhone || cleanPhone.length < 9) {
      res.status(400).json({ code: "error", message: "Số điện thoại không hợp lệ!" });
      return;
    }

    // Nếu đổi SĐT, kiểm tra xem có trùng với khách hàng khác không
    if (cleanPhone !== customer.phone) {
      const duplicate = await Customer.findOne({
        _id: { $ne: customer._id },
        phone: cleanPhone,
        deleted: { $ne: true }
      });

      if (duplicate) {
        res.status(400).json({
          code: "duplicate_phone",
          message: `Số điện thoại "${cleanPhone}" đã được dùng bởi khách hàng khác (${duplicate.fullName})!`,
          existingCustomerId: duplicate._id
        });
        return;
      }
    }

    const oldPhone = customer.phone;

    customer.fullName = fullName;
    customer.phone = cleanPhone;
    customer.email = email;
    customer.address = address;
    customer.notes = notes;
    customer.customerGroup = customerGroup;
    customer.gender = gender;
    customer.birthday = birthday;
    if (req.adminId && mongoose.isValidObjectId(req.adminId)) {
      customer.updatedBy = new mongoose.Types.ObjectId(req.adminId);
    }

    await customer.save();

    // Nếu đổi số điện thoại, cập nhật lại số điện thoại cho các đơn hàng của khách hàng này
    if (oldPhone !== cleanPhone) {
      await Order.updateMany(
        { customerId: customer._id },
        { $set: { "customerInfo.phone": cleanPhone } }
      );
    }

    // Đồng bộ lại số liệu đơn hàng
    await syncCustomerOrdersByPhone(cleanPhone, customer._id);

    res.json({
      code: "success",
      message: `Cập nhật thông tin khách hàng "${customer.fullName}" thành công!`,
      customerId: customer._id
    });
  } catch (error) {
    console.error("Error customer editPatch:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi cập nhật khách hàng!" });
  }
};

/**
 * Hồ sơ chi tiết khách hàng 360° (Thông tin, lịch sử mua hàng, danh sách thiết bị IMEI)
 * GET /admin/customer/:id
 */
export const detail = async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!mongoose.isValidObjectId(id)) {
      res.redirect("/admin/customer");
      return;
    }

    // Tự động kiểm tra và đồng bộ lại số liệu đơn hàng thực tế
    await syncCustomerOrdersByPhone("", id);

    const customer = await Customer.findOne({ _id: id, deleted: { $ne: true } })
      .populate("createdBy", "fullName email")
      .lean();

    if (!customer) {
      res.redirect("/admin/customer");
      return;
    }

    // Lấy tất cả đơn hàng của khách hàng này (theo customerId hoặc theo SĐT)
    const orders = await Order.find({
      $or: [
        { customerId: customer._id },
        { "customerInfo.phone": customer.phone }
      ],
      deleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .lean();

    // Thu thập danh sách toàn bộ các thiết bị (IMEI/Serial) mà khách hàng này đã từng mua
    const ownedDevices: Array<{
      orderCode: string;
      orderId: string;
      purchaseDate: Date;
      productName: string;
      variantName?: string;
      identifier: string;
    }> = [];

    for (const ord of orders) {
      if (ord.orderStatus === "completed") {
        for (const it of ord.items) {
          if (it.identifiers && it.identifiers.length > 0) {
            for (const idf of it.identifiers) {
              ownedDevices.push({
                orderCode: ord.orderCode,
                orderId: String(ord._id),
                purchaseDate: ord.createdAt,
                productName: it.productName,
                variantName: it.variantName,
                identifier: idf
              });
            }
          }
        }
      }
    }

    res.render("admin/customer/detail", {
      pageTitle: `Khách hàng: ${customer.fullName}`,
      customer,
      orders,
      ownedDevices
    });
  } catch (error) {
    console.error("Error customer detail:", error);
    res.redirect("/admin/customer");
  }
};

/**
 * Xóa mềm khách hàng
 * DELETE /admin/customer/:id
 */
export const deleteCustomer = async (req: RequestAccount, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID khách hàng không hợp lệ!" });
      return;
    }

    const customer = await Customer.findById(id);
    if (!customer || customer.deleted) {
      res.status(404).json({ code: "error", message: "Khách hàng không tồn tại!" });
      return;
    }

    customer.deleted = true;
    customer.deletedAt = new Date();
    if (req.adminId && mongoose.isValidObjectId(req.adminId)) {
      customer.deletedBy = new mongoose.Types.ObjectId(req.adminId);
    }

    await customer.save();

    res.json({
      code: "success",
      message: `Đã xóa khách hàng "${customer.fullName}" thành công!`
    });
  } catch (error) {
    console.error("Error delete customer:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi xóa khách hàng!" });
  }
};

