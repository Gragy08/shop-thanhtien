import { Request, Response } from "express";
import slugify from "slugify";
import Attribute from "../../models/attribute.model";

const attributeTypes = ["text", "select", "color"] as const;

interface AttributeOption {
  label: string;
  value: string;
}

const parseOptions = (value: unknown): AttributeOption[] | null => {
  let options: unknown = value;
  if (typeof value === "string") {
    try {
      options = JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }
  if (!Array.isArray(options)) return null;

  const normalized: AttributeOption[] = [];
  const identities = new Set<string>();
  for (const option of options) {
    if (!option || typeof option !== "object") return null;
    const item = option as Record<string, unknown>;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const valueText = typeof item.value === "string" ? item.value.trim() : "";
    const identity = valueText.toLowerCase();
    if (!label || !valueText || identities.has(identity)) return null;
    identities.add(identity);
    normalized.push({ label, value: valueText });
  }
  return normalized;
};

const parseInput = (body: Record<string, unknown>) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = slugify(typeof body.code === "string" && body.code.trim() ? body.code : name, {
    lower: true,
    strict: true,
    trim: true
  });
  const type = body.type;
  const options = parseOptions(body.options);

  if (!name || !code || typeof type !== "string" || !attributeTypes.includes(type as typeof attributeTypes[number]) || !options || options.length === 0) {
    return null;
  }

  return {
    name,
    code,
    type,
    options,
    status: body.status === "inactive" ? "inactive" : "active"
  };
};

export const list = async (_req: Request, res: Response) => {
  const attributeList = await Attribute.find({ deleted: false })
    .sort({ createdAt: "desc" })
    .lean();

  res.render("admin/attribute/list", {
    pageTitle: "Thuộc tính sản phẩm",
    attributeList
  });
};

export const create = (_req: Request, res: Response) => {
  res.render("admin/attribute/form", {
    pageTitle: "Tạo thuộc tính sản phẩm",
    formTitle: "Tạo thuộc tính",
    attribute: null,
    isEdit: false
  });
};

export const createPost = async (req: Request, res: Response) => {
  const input = parseInput(req.body);
  if (!input) {
    res.status(400).json({ code: "error", message: "Tên, loại và danh sách giá trị không hợp lệ!" });
    return;
  }

  if (await Attribute.exists({ code: input.code })) {
    res.status(409).json({ code: "error", message: "Mã thuộc tính đã tồn tại!" });
    return;
  }

  await Attribute.create(input);
  res.json({ code: "success", message: "Tạo thuộc tính thành công!" });
};

export const edit = async (req: Request, res: Response) => {
  const attribute = await Attribute.findOne({ _id: req.params.id, deleted: false }).lean();
  if (!attribute) {
    res.redirect("/admin/product/attribute");
    return;
  }

  res.render("admin/attribute/form", {
    pageTitle: "Chỉnh sửa thuộc tính sản phẩm",
    formTitle: "Chỉnh sửa thuộc tính",
    attribute,
    isEdit: true
  });
};

export const editPatch = async (req: Request, res: Response) => {
  const input = parseInput(req.body);
  if (!input) {
    res.status(400).json({ code: "error", message: "Tên, loại và danh sách giá trị không hợp lệ!" });
    return;
  }

  if (await Attribute.exists({ code: input.code, _id: { $ne: req.params.id } })) {
    res.status(409).json({ code: "error", message: "Mã thuộc tính đã tồn tại!" });
    return;
  }

  const result = await Attribute.updateOne(
    { _id: req.params.id, deleted: false },
    { $set: input }
  );
  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Thuộc tính không tồn tại!" });
    return;
  }

  res.json({ code: "success", message: "Cập nhật thuộc tính thành công!" });
};

export const deletePatch = async (req: Request, res: Response) => {
  const result = await Attribute.updateOne(
    { _id: req.params.id, deleted: false },
    { $set: { deleted: true, deletedAt: new Date(), status: "inactive" } }
  );
  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Thuộc tính không tồn tại!" });
    return;
  }

  res.json({ code: "success", message: "Đã xóa thuộc tính!" });
};