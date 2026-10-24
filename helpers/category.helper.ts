export interface CategoryTreeItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  children: CategoryTreeItem[];
}

interface CategoryRecord {
  _id: unknown;
  name: string;
  slug: string;
  parentId?: unknown;
  status: string;
}

export const buildCategoryTree = (
  categories: CategoryRecord[],
  parentId: string | null = null
): CategoryTreeItem[] => {
  return categories
    .filter((category) => {
      const categoryParentId = category.parentId ? String(category.parentId) : null;
      return categoryParentId === parentId;
    })
    .map((category) => ({
      id: String(category._id),
      name: category.name,
      slug: category.slug,
      status: category.status,
      children: buildCategoryTree(categories, String(category._id))
    }));
};

export const flattenCategoryTree = (
  tree: CategoryTreeItem[],
  level = 0
): Array<CategoryTreeItem & { level: number }> => {
  return tree.flatMap((category) => [
    { ...category, level },
    ...flattenCategoryTree(category.children, level + 1)
  ]);
};

export const findCategoryInTree = (
  tree: CategoryTreeItem[],
  categoryId: string
): CategoryTreeItem | null => {
  for (const node of tree) {
    if (node.id === categoryId) return node;
    if (node.children && node.children.length > 0) {
      const found = findCategoryInTree(node.children, categoryId);
      if (found) return found;
    }
  }
  return null;
};

export const collectDescendantIds = (
  tree: CategoryTreeItem[],
  categoryId: string
): string[] => {
  const target = findCategoryInTree(tree, categoryId);
  if (!target) return [];

  return target.children.flatMap((child) => [
    child.id,
    ...collectDescendantIds([child], child.id)
  ]);
};
