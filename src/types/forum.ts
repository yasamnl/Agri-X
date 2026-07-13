import { ReactNode } from "react";

export interface Comment {
  id: number;
  user_name: string;
  user_avatar?: string | null;
  content: string;
  created_at: string;
  parent_id: number | null;
  like_count: number;
  is_liked?: boolean;
  replies?: Comment[];
}

export interface Post {
  id: number;
  title: string;
  content: string;
  author_name: string;
  author_id?: number;
  author_avatar?: string;
  category_name: string;
  category_slug: string;
  category_icon: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  is_pinned: boolean;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  images?: PostImage[];
  isExpanded?: boolean;
  currentImageIndex?: number;
}

export interface PostImage {
  image_source: ReactNode;
  image_alt: string;
  image_url: string;
  url: string;
  alt?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
}