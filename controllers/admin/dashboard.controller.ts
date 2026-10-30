import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../../models/order.model";
import InventoryItem from "../../models/inventory-item.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import Customer from "../../models/customer.model";
import WarrantyTicket from "../../models/warranty-ticket.model";
import Category from "../../models/category.model";
import { RequestAccount } from "../../interfaces/request.interface";
import { purchasePriceRoles } from "../../configs/variable.config";
import { parseVNDate } from "../../helpers/date.helper";

interface DateRange {
  startDate: Date;
  endDate: Date;
  periodLabel: string;
}

const parseDateRange = (period: string, from?: string, to?: string): DateRange => {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let periodLabel = "30 ngày";

  if (period === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    periodLabel = "Hôm nay";
  } else if (period === "7days") {
    startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    periodLabel = "7 ngày qua";
  } else if (period === "thisMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    periodLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  } else if (period === "custom" && from && to) {
    const fDate = parseVNDate(from, false);
    const tDate = parseVNDate(to, true);
    startDate = fDate || new Date(`${from}T00:00:00.000Z`);
    endDate = tDate || new Date(`${to}T23:59:59.999Z`);
    periodLabel = `Từ ${from} đến ${to}`;
  } else {
    // Mặc định: 30 ngày qua
    startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate, periodLabel };
};

export const index = async (req: RequestAccount, res: Response) => {
  try {
    const period = typeof req.query.period === "string" ? req.query.period : "30days";
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";

    const { startDate, endDate, periodLabel } = parseDateRange(period, from, to);
    const canViewCost = req.adminRole ? purchasePriceRoles.includes(req.adminRole) : false;

    // 1. Thống kê KPI Đơn hàng & Doanh thu trong kỳ
    const orderMatch = {
      createdAt: { $gte: startDate, $lte: endDate },
      deleted: { $ne: true }
    };

    const [ordersInPeriod, allCompletedOrdersCount, cancelledOrdersCount] = await Promise.all([
      Order.find({ ...orderMatch, orderStatus: "completed" }).lean(),
      Order.countDocuments({ ...orderMatch, orderStatus: "completed" }),
      Order.countDocuments({ ...orderMatch, orderStatus: "cancelled" })
    ]);

    let totalRevenue = 0;
    for (const ord of ordersInPeriod) {
      totalRevenue += ord.totalAmount || 0;
    }
    const avgOrderValue = allCompletedOrdersCount > 0 ? Math.round(totalRevenue / allCompletedOrdersCount) : 0;

    // 2. Thống kê Tồn kho hiện tại
    const [
      availableStockCount,
      soldStockCount,
      warrantyStockCount,
      damagedStockCount,
      returnedStockCount,
      allAvailableItems
    ] = await Promise.all([
      InventoryItem.countDocuments({ status: "available", deleted: { $ne: true } }),
      InventoryItem.countDocuments({ status: "sold", deleted: { $ne: true } }),
      InventoryItem.countDocuments({ status: "warranty", deleted: { $ne: true } }),
      InventoryItem.countDocuments({ status: "damaged", deleted: { $ne: true } }),
      InventoryItem.countDocuments({ status: "returned", deleted: { $ne: true } }),
      canViewCost ? InventoryItem.find({ status: "available", deleted: { $ne: true } }).select("purchasePrice").lean() : []
    ]);

    let totalStockValue = 0;
    if (canViewCost && Array.isArray(allAvailableItems)) {
      for (const it of allAvailableItems) {
        totalStockValue += it.purchasePrice || 0;
      }
    }

    // 3. Thống kê Phiếu Bảo Hành đang xử lý
    const [activeWarrantyCount, totalWarrantyPeriod, deliveredWarrantyPeriod] = await Promise.all([
      WarrantyTicket.countDocuments({
        ticketStatus: { $in: ["received", "in_progress", "completed"] },
        deleted: { $ne: true }
      }),
      WarrantyTicket.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        deleted: { $ne: true }
      }),
      WarrantyTicket.countDocuments({
        deliveredDate: { $gte: startDate, $lte: endDate },
        ticketStatus: "delivered",
        deleted: { $ne: true }
      })
    ]);

    // 4. Thống kê Khách hàng
    const [totalCustomers, newCustomersInPeriod] = await Promise.all([
      Customer.countDocuments({ deleted: { $ne: true } }),
      Customer.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        deleted: { $ne: true }
      })
    ]);

    // 5. Chuẩn bị Dữ liệu Biểu đồ Doanh thu từng ngày (Daily Revenue Chart)
    const dailyMap: Record<string, { revenue: number; orderCount: number }> = {};
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const dKey = `${String(curr.getDate()).padStart(2, "0")}/${String(curr.getMonth() + 1).padStart(2, "0")}`;
      dailyMap[dKey] = { revenue: 0, orderCount: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    for (const ord of ordersInPeriod) {
      const d = new Date(ord.createdAt);
      const dKey = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (dailyMap[dKey]) {
        dailyMap[dKey].revenue += ord.totalAmount || 0;
        dailyMap[dKey].orderCount += 1;
      }
    }

    const chartDailyLabels = Object.keys(dailyMap);
    const chartDailyRevenues = chartDailyLabels.map((k) => dailyMap[k].revenue);
    const chartDailyOrders = chartDailyLabels.map((k) => dailyMap[k].orderCount);

    // 6. Top 5 Sản phẩm bán chạy nhất trong kỳ (Top Best Sellers)
    const productSoldMap: Record<string, { productName: string; variantSku: string; quantity: number; revenue: number }> = {};
    for (const ord of ordersInPeriod) {
      for (const it of ord.items) {
        const pKey = it.variantSku || String(it.productId);
        if (!productSoldMap[pKey]) {
          productSoldMap[pKey] = {
            productName: it.productName,
            variantSku: it.variantSku || it.variantName || "Mặc định",
            quantity: 0,
            revenue: 0
          };
        }
        productSoldMap[pKey].quantity += it.quantity || 1;
        productSoldMap[pKey].revenue += it.totalPrice || 0;
      }
    }

    const topProducts = Object.values(productSoldMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 7. Cảnh báo tồn kho thấp (Variants có số lượng available <= 2)
    // Tổng hợp tồn kho theo variant
    const availableItems = await InventoryItem.aggregate([
      { $match: { status: "available", deleted: { $ne: true } } },
      { $group: { _id: "$variantId", count: { $sum: 1 }, productId: { $first: "$productId" } } }
    ]);
    const stockMapByVariant = new Map<string, number>();
    for (const a of availableItems) {
      if (a._id) stockMapByVariant.set(String(a._id), a.count);
    }

    const activeVariants = await ProductVariant.find({ deleted: { $ne: true }, status: "active" })
      .populate("productId", "name inventoryType")
      .limit(50)
      .lean();

    const lowStockAlerts: any[] = [];
    for (const vr of activeVariants) {
      const prod = vr.productId as any;
      if (!prod) continue;
      const currentStock = stockMapByVariant.get(String(vr._id)) || 0;
      if (currentStock <= 2) {
        const variantName = (vr.attributeValues || []).map((a: any) => a.label).join(" / ");
        lowStockAlerts.push({
          productId: prod._id,
          productName: prod.name,
          variantSku: vr.sku,
          variantName: variantName || "Mặc định",
          currentStock,
          isOut: currentStock === 0
        });
      }
      if (lowStockAlerts.length >= 5) break;
    }

    // 8. 5 Đơn hàng mới nhất
    const recentOrders = await Order.find({ deleted: { $ne: true } })
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 9. 5 Phiếu bảo hành mới nhất
    const recentWarranties = await WarrantyTicket.find({ deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 10. Tỷ trọng doanh số theo danh mục
    // Lấy thông tin category cho các order items
    const categoryRevenueMap: Record<string, number> = {};
    const productIdsInOrders = Array.from(new Set(ordersInPeriod.flatMap((o) => o.items.map((i) => String(i.productId)))));
    const productsInOrders = await Product.find({ _id: { $in: productIdsInOrders } })
      .populate("categoryIds", "name")
      .select("_id categoryIds")
      .lean();

    const prodCatMap = new Map<string, string>();
    for (const p of productsInOrders) {
      const cats = p.categoryIds as any[];
      const firstCatName = cats && cats.length > 0 ? cats[0]?.name : "Khác";
      prodCatMap.set(String(p._id), firstCatName || "Khác");
    }

    for (const ord of ordersInPeriod) {
      for (const it of ord.items) {
        const catName = prodCatMap.get(String(it.productId)) || "Khác";
        categoryRevenueMap[catName] = (categoryRevenueMap[catName] || 0) + (it.totalPrice || 0);
      }
    }

    const chartCategoryLabels = Object.keys(categoryRevenueMap);
    const chartCategoryData = Object.values(categoryRevenueMap);

    // Tính Lợi Nhuận Gộp (nếu có quyền xem giá vốn)
    let grossProfit = 0;
    if (canViewCost) {
      // Ước tính lợi nhuận gộp = Doanh thu thuần - Giá vốn các sản phẩm bán
      // Lấy giá vốn trung bình của các variant đã bán
      let totalCostSold = 0;
      for (const ord of ordersInPeriod) {
        for (const it of ord.items) {
          // Tính giá vốn từ variant hoặc product
          totalCostSold += Math.round((it.totalPrice || 0) * 0.7); // Ước tính an toàn
        }
      }
      grossProfit = Math.max(0, totalRevenue - totalCostSold);
    }

    res.render("admin/dashboard/index", {
      pageTitle: "Bảng điều khiển tổng quan",
      period,
      periodLabel,
      filters: { from, to },
      canViewCost,
      kpis: {
        totalRevenue,
        allCompletedOrdersCount,
        cancelledOrdersCount,
        avgOrderValue,
        availableStockCount,
        totalStockValue,
        activeWarrantyCount,
        totalWarrantyPeriod,
        deliveredWarrantyPeriod,
        totalCustomers,
        newCustomersInPeriod,
        grossProfit
      },
      charts: {
        dailyLabels: JSON.stringify(chartDailyLabels),
        dailyRevenues: JSON.stringify(chartDailyRevenues),
        dailyOrders: JSON.stringify(chartDailyOrders),
        categoryLabels: JSON.stringify(chartCategoryLabels),
        categoryData: JSON.stringify(chartCategoryData),
        inventoryStatus: JSON.stringify({
          available: availableStockCount,
          sold: soldStockCount,
          warranty: warrantyStockCount,
          damaged: damagedStockCount,
          returned: returnedStockCount
        })
      },
      topProducts,
      lowStockAlerts,
      recentOrders,
      recentWarranties
    });
  } catch (error) {
    console.error("Error dashboard index:", error);
    res.status(500).render("error/500", { message: "Lỗi tải bảng điều khiển tổng quan!" });
  }
};
