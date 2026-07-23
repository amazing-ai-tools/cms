export type ContentNodeType = 'category' | 'subcategory' | 'page';

export interface ContentNode {
  id: string;
  workspaceId: string;
  parentId: string | null;
  type: ContentNodeType;
  title: string;
  slug?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContentNodeInput {
  workspaceId: string;
  parentId: string | null;
  type: ContentNodeType;
  title: string;
  slug?: string;
}

export interface UpdateContentNodeInput {
  title?: string;
  slug?: string;
}

export interface ContentService {
  createNode(input: CreateContentNodeInput): Promise<ContentNode>;
  deleteNode(nodeId: string): Promise<void>;
  listNodes(workspaceId: string): Promise<ContentNode[]>;
  moveNode(nodeId: string, parentId: string | null): Promise<ContentNode>;
  updateNode(nodeId: string, input: UpdateContentNodeInput): Promise<ContentNode>;
}
