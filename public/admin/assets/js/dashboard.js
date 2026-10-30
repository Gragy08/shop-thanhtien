document.addEventListener("DOMContentLoaded", () => {
  // Lấy dữ liệu truyền từ Pug server-side
  const dailyLabels = window.DASHBOARD_DATA?.dailyLabels || [];
  const dailyRevenues = window.DASHBOARD_DATA?.dailyRevenues || [];
  const dailyOrders = window.DASHBOARD_DATA?.dailyOrders || [];
  const categoryLabels = window.DASHBOARD_DATA?.categoryLabels || [];
  const categoryData = window.DASHBOARD_DATA?.categoryData || [];
  const invStatus = window.DASHBOARD_DATA?.inventoryStatus || {};

  // Format tiền tệ VNĐ
  const formatVND = (val) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  // 1. Biểu đồ Doanh thu từng ngày (Line / Area Chart)
  const ctxRevenue = document.querySelector("#chartDailyRevenue")?.getContext("2d");
  if (ctxRevenue && typeof Chart !== "undefined") {
    new Chart(ctxRevenue, {
      type: "line",
      data: {
        labels: dailyLabels,
        datasets: [
          {
            label: "Doanh thu (VNĐ)",
            data: dailyRevenues,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#10b981",
            pointRadius: 3.5,
            pointHoverRadius: 6,
            yAxisID: "y"
          },
          {
            label: "Số đơn hàng",
            data: dailyOrders,
            borderColor: "#0ea5e9",
            backgroundColor: "rgba(14, 165, 233, 0.08)",
            borderWidth: 2,
            borderDash: [4, 4],
            fill: false,
            tension: 0.3,
            pointBackgroundColor: "#0ea5e9",
            pointRadius: 2.5,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              font: { size: 12, family: "'Segoe UI', sans-serif" }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.yAxisID === "y") {
                  return ` Doanh thu: ${formatVND(ctx.raw)}`;
                }
                return ` Đơn hàng: ${ctx.raw} đơn`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: {
              callback: (val) => {
                if (val >= 1000000) return `${val / 1000000} tr`;
                if (val >= 1000) return `${val / 1000} k`;
                return val;
              },
              font: { size: 11 }
            }
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: {
              stepSize: 1,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  // 2. Biểu đồ Trạng thái Kho hàng (Doughnut Chart)
  const ctxInventory = document.querySelector("#chartInventoryStatus")?.getContext("2d");
  if (ctxInventory && typeof Chart !== "undefined") {
    new Chart(ctxInventory, {
      type: "doughnut",
      data: {
        labels: ["Có sẵn", "Đã bán", "Đang bảo hành", "Hàng lỗi", "Trả hàng"],
        datasets: [
          {
            data: [
              invStatus.available || 0,
              invStatus.sold || 0,
              invStatus.warranty || 0,
              invStatus.damaged || 0,
              invStatus.returned || 0
            ],
            backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"],
            borderWidth: 2,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} thiết bị`
            }
          }
        },
        cutout: "65%"
      }
    });
  }

  // 3. Biểu đồ Doanh thu theo Nhóm hàng (nếu có dữ liệu)
  const ctxCategory = document.querySelector("#chartCategoryRevenue")?.getContext("2d");
  if (ctxCategory && typeof Chart !== "undefined" && categoryLabels.length > 0) {
    new Chart(ctxCategory, {
      type: "bar",
      data: {
        labels: categoryLabels,
        datasets: [
          {
            label: "Doanh thu (VNĐ)",
            data: categoryData,
            backgroundColor: ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899"],
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Doanh thu: ${formatVND(ctx.raw)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: {
              callback: (val) => `${val / 1000000} tr`,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }
});

