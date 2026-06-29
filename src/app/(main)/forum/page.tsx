'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  Search, Heart, MessageSquare, Share2, Plus, X, 
  SlidersHorizontal, Check, Loader2, ChevronLeft, ChevronRight,
  MoreHorizontal, Bookmark, Send, AlertCircle, ChevronDown, ChevronUp,
  Image as ImageIcon, Flag, Link2, EyeOff, ThumbsDown, User as UserIcon
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { CreatePostModal } from '@/components/forum/CreatePostModal';
import { ReportModal } from '@/components/reports/ReportModal';
import { getCookie } from '@/lib/auth';
import { Post, Category, Comment } from '@/types/forum';

const IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect fill="%23f5f9f4" width="400" height="400"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';

const POSTS_PER_PAGE = 5;

export default function ForumPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  // State Filters
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data State
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Infinite Scroll State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  // UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isLiking, setIsLiking] = useState<number | null>(null);
  const [isBookmarking, setIsBookmarking] = useState<number | null>(null);
  
  // Dropdown Menu State
  const [activeDropdownPostId, setActiveDropdownPostId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // ✅ Report Post Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  
  // ✅ Report Comment Modal State
  const [showCommentReportModal, setShowCommentReportModal] = useState(false);
  const [commentReportTarget, setCommentReportTarget] = useState<{
    comment: Comment;
    parentPost: Post | null;
  } | null>(null);
  
  // Comment Modal State
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null); // ✅ Simpan post untuk context
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  
  // Modal Comments Data
  const [modalComments, setModalComments] = useState<Comment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  
  // Like Comment State
  const [likingCommentId, setLikingCommentId] = useState<number | null>(null);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<number>>(new Set());

  // Toggle Replies State
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  
  const modalRef = useRef<HTMLDivElement>(null);

  // ============================================
  // EFFECTS & FETCHING
  // ============================================

  useEffect(() => {
    fetchForumCategories();
  }, []);

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    fetchPosts(1, true);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdownPostId(null);
      }
    };

    if (activeDropdownPostId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdownPostId]);

  useEffect(() => {
    if (isFilterModalOpen || selectedPostId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isFilterModalOpen, selectedPostId]);

  const fetchForumCategories = async () => {
    try {
      const res = await fetch('/api/forum/categories'); 
      if (res.ok) {
        const data = await res.json();
        const allCat = { id: 0, name: 'Semua', slug: 'all', icon: '💬' };
        setCategories([allCat, ...(data.categories || [])]);
      }
    } catch (err) {
      setCategories([
        { id: 0, name: 'Semua', slug: 'all', icon: '💬' },
        { id: 1, name: 'Tips Bertani', slug: 'tips-bertani', icon: '🌱' },
        { id: 2, name: 'Harga Pasar', slug: 'harga-pasar', icon: '💰' },
      ]);
    }
  };

  const fetchPosts = async (pageNum: number = 1, reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const params = new URLSearchParams({
        category: activeCategory,
        search: searchQuery,
        sort: 'newest',
        page: pageNum.toString(),
        limit: POSTS_PER_PAGE.toString(),
      });

      const token = getCookie('accessToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/forum/posts?${params}`, { headers });
      
      if (res.ok) {
        const data = await res.json();
        const mappedPosts = (data.posts || []).map((p: any) => ({
          ...p,
          images: p.images || [],
          is_pinned: Boolean(p.is_pinned),
          is_liked: Boolean(p.is_liked),
          is_bookmarked: Boolean(p.is_bookmarked),
          isExpanded: false,
          currentImageIndex: 0
        }));

        if (reset) {
          setPosts(mappedPosts);
        } else {
          setPosts(prev => [...prev, ...mappedPosts]);
        }

        setHasMore(mappedPosts.length === POSTS_PER_PAGE);
      }
    } catch (error) {
      console.error('Fetch posts error:', error);
      toast.error('Gagal memuat diskusi');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMorePosts = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, false);
  };

  // ============================================
  // ACTIONS
  // ============================================

  const handleLikePost = async (postId: number) => {
    if (!isAuthenticated) {
      toast.error('Silakan login untuk memberikan like');
      router.push('/login');
      return;
    }
    
    setIsLiking(postId);
    
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          is_liked: !post.is_liked,
          like_count: post.is_liked ? post.like_count - 1 : post.like_count + 1,
        };
      }
      return post;
    }));

    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/forum/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              is_liked: data.liked,
              like_count: data.like_count !== undefined ? data.like_count : post.like_count,
            };
          }
          return post;
        }));
        toast.success(data.liked ? '❤️ Disukai!' : '❌ Like dibatalkan');
      } else {
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              is_liked: !post.is_liked,
              like_count: post.is_liked ? post.like_count + 1 : post.like_count - 1,
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Like post error:', error);
      toast.error('Gagal memproses like');
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: !post.is_liked,
            like_count: post.is_liked ? post.like_count + 1 : post.like_count - 1,
          };
        }
        return post;
      }));
    } finally {
      setIsLiking(null);
    }
  };

  const handleBookmarkPost = async (postId: number) => {
    if (!isAuthenticated) {
      toast.error('Silakan login untuk menyimpan postingan');
      router.push('/login');
      return;
    }

    setIsBookmarking(postId);

    setPosts(posts.map(post => {
      if (post.id === postId) {
        return { ...post, is_bookmarked: !post.is_bookmarked };
      }
      return post;
    }));

    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/forum/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return { ...post, is_bookmarked: data.bookmarked };
          }
          return post;
        }));
        toast.success(data.bookmarked ? '🔖 Disimpan!' : '❌ Bookmark dihapus');
      } else {
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return { ...post, is_bookmarked: !post.is_bookmarked };
          }
          return post;
        }));
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal memproses bookmark');
      }
    } catch (error: any) {
      console.error('Bookmark error:', error);
      toast.error(error.message || 'Gagal memproses bookmark');
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return { ...post, is_bookmarked: !post.is_bookmarked };
        }
        return post;
      }));
    } finally {
      setIsBookmarking(null);
    }
  };

  const handleSharePost = async (post: Post) => {
    const shareUrl = `${window.location.origin}/forum/post/${post.id}`;
    const shareTitle = post.title;
    const shareText = post.content.substring(0, 100) + '...';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        toast.success('✅ Berhasil dibagikan!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }

    setActiveDropdownPostId(null);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('🔗 Link disalin ke clipboard!');
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('🔗 Link disalin!');
      } catch {
        toast.error('Gagal menyalin link');
      }
      document.body.removeChild(textArea);
    }
  };

  // ✅ ✅ UPDATED: Handle Report Post dengan context snapshot
  const handleReportPost = (post: Post) => {
    setReportTarget(post);
    setShowReportModal(true);
    setActiveDropdownPostId(null);
  };

  // ✅ ✅ UPDATED: Handle Report Comment dengan context snapshot lengkap
  const handleReportComment = (comment: Comment) => {
    setCommentReportTarget({
      comment,
      parentPost: selectedPost, // ✅ Kirim parent post sebagai context
    });
    setShowCommentReportModal(true);
  };

  const handlePostPreference = async (postId: number, type: 'hide' | 'not_interested') => {
    if (!isAuthenticated) {
      toast.error('Silakan login untuk menggunakan fitur ini');
      router.push('/login');
      return;
    }

    setPosts(posts.filter(p => p.id !== postId));
    setActiveDropdownPostId(null);

    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/forum/posts/${postId}/preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.action === 'added') {
          toast.success(
            type === 'hide' 
              ? '🙈 Postingan disembunyikan' 
              : '👎 Terima kasih atas feedback Anda'
          );
        } else {
          toast.success('Preferensi dihapus');
          fetchPosts(1, true);
        }
      } else {
        throw new Error('Gagal memproses');
      }
    } catch (error: any) {
      console.error('Preference error:', error);
      toast.error(error.message || 'Gagal memproses preferensi');
      fetchPosts(1, true);
    }
  };

  const handleHidePost = (postId: number) => {
    handlePostPreference(postId, 'hide');
  };

  const handleNotInterested = (postId: number) => {
    handlePostPreference(postId, 'not_interested');
  };

  // ============================================
  // COMMENTS HANDLERS
  // ============================================

  const fetchComments = async (postId: number) => {
    setIsCommentsLoading(true);
    setCommentError(null);
    setModalComments([]);
    setExpandedReplies(new Set());

    try {
      const res = await fetch(`/api/forum/posts/${postId}/comments?sort=desc`);
      
      if (!res.ok) {
        throw new Error('Gagal memuat komentar');
      }

      const data = await res.json();
      
      if (data.success) {
        const convertedComments = convertCommentTypes(data.comments || []);
        const sortedComments = sortCommentsByDate(convertedComments, 'desc');
        setModalComments(sortedComments);
      } else {
        setModalComments([]);
      }
    } catch (err: any) {
      console.error('Fetch comments error:', err);
      setCommentError(err.message || 'Terjadi kesalahan jaringan');
      toast.error('Gagal memuat komentar');
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const convertCommentTypes = (comments: any[]): Comment[] => {
    return comments.map((c: any) => ({
      id: Number(c.id),
      user_name: c.user_name,
      user_avatar: c.user_avatar || null,
      content: c.content,
      created_at: c.created_at,
      parent_id: c.parent_id ? Number(c.parent_id) : null,
      like_count: Number(c.like_count),
      is_liked: false,
      replies: c.replies ? convertCommentTypes(c.replies) : [],
    }));
  };

  const sortCommentsByDate = (comments: Comment[], order: 'asc' | 'desc' = 'desc'): Comment[] => {
    return comments
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return order === 'desc' ? dateB - dateA : dateA - dateB;
      })
      .map(comment => ({
        ...comment,
        replies: comment.replies && comment.replies.length > 0 
          ? sortCommentsByDate(comment.replies, order) 
          : [],
      }));
  };

  const handleLikeComment = async (commentId: number) => {
    if (!isAuthenticated) {
      toast.error('Silakan login untuk memberikan like');
      router.push('/login');
      return;
    }

    const isCurrentlyLiked = likedCommentIds.has(commentId);
    const action = isCurrentlyLiked ? 'unlike' : 'like';

    setLikedCommentIds(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyLiked) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });

    setLikingCommentId(commentId);

    try {
      const token = getCookie('accessToken');
      
      const res = await fetch(`/api/forum/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses like');
      }
      
      setModalComments(prevComments => {
        const updateLikesRecursively = (comments: Comment[]): Comment[] => {
          return comments.map(c => {
            if (c.id === commentId) {
              return { ...c, like_count: data.like_count };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: updateLikesRecursively(c.replies) };
            }
            return c;
          });
        };
        return updateLikesRecursively(prevComments);
      });

      toast.success(action === 'like' ? '❤️ Komentar disukai!' : '❌ Like dibatalkan');

    } catch (error: any) {
      console.error('Like comment error:', error);
      
      setLikedCommentIds(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyLiked) {
          newSet.add(commentId);
        } else {
          newSet.delete(commentId);
        }
        return newSet;
      });
      
      toast.error(error.message || 'Gagal memproses like');
    } finally {
      setLikingCommentId(null);
    }
  };

  const toggleCaption = (postId: number) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, isExpanded: !p.isExpanded } : p));
  };

  const nextImage = (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();
    setPosts(posts.map(p => {
      if (p.id === postId && p.images && p.images.length > 0) {
        const nextIndex = (p.currentImageIndex! + 1) % p.images.length;
        return { ...p, currentImageIndex: nextIndex };
      }
      return p;
    }));
  };

  const prevImage = (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();
    setPosts(posts.map(p => {
      if (p.id === postId && p.images && p.images.length > 0) {
        const prevIndex = (p.currentImageIndex! - 1 + p.images.length) % p.images.length;
        return { ...p, currentImageIndex: prevIndex };
      }
      return p;
    }));
  };

  // ✅ ✅ UPDATED: Simpan post saat buka modal komentar
  const openCommentModal = (postId: number) => {
    const post = posts.find(p => p.id === postId) || null;
    setSelectedPostId(postId);
    setSelectedPost(post); // ✅ Simpan post untuk context report
    fetchComments(postId);
  };

  const closeCommentModal = () => {
    setSelectedPostId(null);
    setSelectedPost(null); // ✅ Reset post
    setReplyingTo(null);
    setCommentInput('');
    setModalComments([]);
    setCommentError(null);
    setExpandedReplies(new Set());
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !selectedPostId) return;
    
    try {
      const token = getCookie('accessToken');
      const payload: any = {
        content: commentInput,
        post_id: selectedPostId,
        ...(replyingTo && { parent_id: replyingTo.id }) 
      };

      const res = await fetch('/api/forum/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCommentInput('');
        setReplyingTo(null);
        toast.success('✅ Komentar berhasil dikirim!');
        fetchComments(selectedPostId);
        
        setPosts(posts.map(p => {
          if (p.id === selectedPostId) {
            return { ...p, comment_count: p.comment_count + 1 };
          }
          return p;
        }));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal mengirim komentar');
      }
    } catch (err) {
      console.error('Submit comment error:', err);
      toast.error('Terjadi kesalahan jaringan');
    }
  };

  const toggleReplies = (commentId: number) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: id });
    } catch {
      return dateString;
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderNestedComments = (comments: Comment[], depth = 0) => {
    return comments.map((comment) => {
      const hasReplies = comment.replies && comment.replies.length > 0;
      const isExpanded = expandedReplies.has(comment.id);
      const isLikedByUser = likedCommentIds.has(comment.id);

      return (
        <div key={comment.id} className={`${depth > 0 ? 'mt-4' : 'mb-6 last:mb-0'}`}>
          <div className={`flex gap-3 ${depth > 0 ? 'ml-6 sm:ml-8 border-l-2 border-border pl-4' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden border border-border">
              {comment.user_avatar ? (
                <img src={comment.user_avatar} alt="" className="w-full h-full object-cover" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }} />
              ) : null}
              {!comment.user_avatar && <span>{comment.user_name.charAt(0)}</span>}
            </div>
            
            <div className="flex-1">
              <div className="bg-surface p-3 rounded-2xl rounded-tl-none shadow-sm relative">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm text-text-primary">{comment.user_name}</span>
                  <span className="text-[10px] text-text-secondary">{formatTime(comment.created_at)}</span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed break-words">{comment.content}</p>
                
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => handleLikeComment(comment.id)}
                    disabled={likingCommentId === comment.id}
                    className={`text-xs flex items-center gap-1 transition-all duration-200 disabled:opacity-50 ${
                      isLikedByUser 
                        ? 'text-red-500 font-medium' 
                        : 'text-text-secondary hover:text-red-500'
                    }`}
                  >
                    <Heart 
                      className={`w-3 h-3 transition-all duration-200 ${
                        isLikedByUser ? 'fill-red-500 scale-110' : ''
                      }`} 
                    /> 
                    {comment.like_count}
                  </button>
                  
                  <button 
                    onClick={() => setReplyingTo(comment)}
                    className="text-xs font-medium text-text-secondary hover:text-primary transition-colors"
                  >
                    Balas
                  </button>

                  {/* ✅ Tombol Report Komentar */}
                  <button 
                    onClick={() => handleReportComment(comment)}
                    className="text-xs font-medium text-text-secondary hover:text-red-500 transition-colors ml-auto"
                    title="Laporkan komentar ini"
                  >
                    <Flag className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {hasReplies && (
                <button 
                  onClick={() => toggleReplies(comment.id)}
                  className="flex items-center gap-1 mt-2 ml-2 text-xs text-text-secondary hover:text-primary transition-colors"
                >
                  {isExpanded ? (
                    <><ChevronUp className="w-3 h-3" /> Sembunyikan {comment.replies?.length} balasan</>
                  ) : (
                    <><ChevronDown className="w-3 h-3" /> Lihat {comment.replies?.length} balasan</>
                  )}
                </button>
              )}
            </div>
          </div>
          
          {hasReplies && isExpanded && (
            <div className="mt-2">
              {renderNestedComments(comment.replies!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="animate-fade-in min-h-screen bg-background pb-20 sm:pb-0 relative">
      
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">AgriForum</h1>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsFilterModalOpen(true)} 
             className="p-2 hover:bg-surface rounded-full transition-colors text-text-secondary hover:text-primary"
           >
             <SlidersHorizontal className="w-5 h-5" />
           </button>

           {isAuthenticated && (
             <button 
               onClick={() => setShowCreateModal(true)}
               className="p-2 bg-primary text-white rounded-full hover:bg-secondary transition-all shadow-md active:scale-95"
             >
               <Plus className="w-5 h-5" />
             </button>
           )}
        </div>
      </div>

      {/* MAIN FEED */}
      <main className="max-w-500 mx-auto pt-2">
        
        {isLoading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-text-secondary">Memuat diskusi...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <MessageSquare className="w-16 h-16 text-text-secondary/30" />
            <p className="text-text-secondary">Belum ada diskusi di kategori ini.</p>
            {isAuthenticated && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="btn-primary mt-2"
              >
                Buat Diskusi Pertama
              </button>
            )}
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <article key={post.id} className="bg-background border-b border-border sm:border sm:rounded-xl sm:mb-6 sm:shadow-sm last:border-b-0">
                
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full">
                      <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-surface">
                         {post.author_avatar ? (
                           <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-xs font-bold bg-primary/10 text-primary">
                             {post.author_name.charAt(0)}
                           </div>
                         )}
                      </div>
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-text-primary">{post.author_name}</p>
                      <p className="text-xs text-text-secondary">{post.category_name}</p>
                    </div>
                  </div>
                  
                  <div className="relative" ref={activeDropdownPostId === post.id ? dropdownRef : null}>
                    <button 
                      onClick={() => setActiveDropdownPostId(activeDropdownPostId === post.id ? null : post.id)}
                      className="text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-surface transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {activeDropdownPostId === post.id && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                        <button
                          onClick={() => handleSharePost(post)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
                        >
                          <Share2 className="w-4 h-4 text-text-secondary" />
                          <span className="text-sm text-text-primary">Bagikan Postingan</span>
                        </button>

                        <button
                          onClick={() => {
                            copyToClipboard(`${window.location.origin}/forum/post/${post.id}`);
                            setActiveDropdownPostId(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
                        >
                          <Link2 className="w-4 h-4 text-text-secondary" />
                          <span className="text-sm text-text-primary">Salin Link</span>
                        </button>

                        <button
                          onClick={() => {
                            handleBookmarkPost(post.id);
                            setActiveDropdownPostId(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
                        >
                          <Bookmark className={`w-4 h-4 ${post.is_bookmarked ? 'fill-primary text-primary' : 'text-text-secondary'}`} />
                          <span className="text-sm text-text-primary">
                            {post.is_bookmarked ? 'Hapus dari Simpanan' : 'Simpan Postingan'}
                          </span>
                        </button>

                        <button
                          onClick={() => handleHidePost(post.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
                        >
                          <EyeOff className="w-4 h-4 text-text-secondary" />
                          <span className="text-sm text-text-primary">Sembunyikan</span>
                        </button>

                        <button
                          onClick={() => handleNotInterested(post.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
                        >
                          <ThumbsDown className="w-4 h-4 text-text-secondary" />
                          <span className="text-sm text-text-primary">Tidak Tertarik</span>
                        </button>

                        <div className="border-t border-border" />

                        <button
                          onClick={() => handleReportPost(post)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                        >
                          <Flag className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600 dark:text-red-400">Laporkan Postingan</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {post.images && post.images.length > 0 ? (
                  <div className="relative aspect-square w-full bg-black">
                    <img 
                      src={post.images[post.currentImageIndex!]?.image_url || IMAGE_PLACEHOLDER} 
                      alt={post.images[post.currentImageIndex!]?.image_alt || post.title}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER;
                      }}
                    />
                    
                    {post.images.length > 1 && (
                      <>
                        <button onClick={(e) => prevImage(e, post.id)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm">
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={(e) => nextImage(e, post.id)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {post.images.map((_, idx) => (
                            <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === post.currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`} />
                          ))}
                        </div>
                      </>
                    )}
                    
                    {post.images[post.currentImageIndex!]?.image_source && (
                      <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-2 py-0.5 rounded-full">
                        📷 {post.images[post.currentImageIndex!]?.image_source}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="p-4 pb-2">
                     <h3 className="font-bold text-lg text-text-primary mb-1">{post.title}</h3>
                  </div>
                )}

                <div className="p-3 pb-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handleLikePost(post.id)} 
                        disabled={isLiking === post.id}
                        className={`transition-transform active:scale-90 disabled:opacity-50 ${post.is_liked ? 'text-red-500' : 'text-text-primary hover:text-gray-600'}`}
                      >
                        <Heart className={`w-7 h-7 ${post.is_liked ? 'fill-current' : ''}`} />
                      </button>
                      <button onClick={() => openCommentModal(post.id)} className="text-text-primary hover:text-gray-600 transition-transform active:scale-90">
                        <MessageSquare className="w-7 h-7" />
                      </button>
                      <button 
                        onClick={() => handleSharePost(post)}
                        className="text-text-primary hover:text-gray-600 transition-transform active:scale-90"
                      >
                        <Send className="w-7 h-7" />
                      </button>
                    </div>
                    <button 
                      onClick={() => handleBookmarkPost(post.id)}
                      disabled={isBookmarking === post.id}
                      className={`transition-transform active:scale-90 disabled:opacity-50 ${post.is_bookmarked ? 'text-primary' : 'text-text-primary hover:text-gray-600'}`}
                    >
                      <Bookmark className={`w-7 h-7 ${post.is_bookmarked ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <p className="font-semibold text-sm text-text-primary mb-1">
                    {post.like_count.toLocaleString()} suka
                  </p>

                  <div className="text-sm text-text-primary">
                    <span className="font-semibold mr-2">{post.author_name}</span>
                    <span className={`${post.isExpanded ? '' : 'line-clamp-2'}`}>
                      {post.content}
                    </span>
                    {post.content.length > 100 && (
                      <button onClick={() => toggleCaption(post.id)} className="text-text-secondary ml-1 text-xs">
                        {post.isExpanded ? 'sembunyikan' : 'selengkapnya'}
                      </button>
                    )}
                  </div>

                  {post.comment_count > 0 && (
                    <button onClick={() => openCommentModal(post.id)} className="text-text-secondary text-sm mt-1 w-full text-left hover:text-text-primary">
                      Lihat semua {post.comment_count} komentar
                    </button>
                  )}
                  
                  <p className="text-[10px] text-text-secondary uppercase mt-1 tracking-wide">
                    {formatTime(post.created_at)}
                  </p>
                </div>
              </article>
            ))}

            <div ref={sentinelRef} className="py-8 flex justify-center">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Memuat lebih banyak...</span>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <p className="text-sm text-text-secondary">🎉 Anda telah melihat semua postingan</p>
              )}
            </div>
          </>
        )}
      </main>

      {/* ============================================
          MODAL 1: CREATE POST
      ============================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="relative w-full sm:max-w-200 bg-surface sm:rounded-2xl shadow-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-hidden animate-slide-up border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-surface z-10">
              <h2 className="text-lg sm:text-xl font-bold text-text-primary">Buat Diskusi Baru</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
              <CreatePostModal 
                onClose={() => setShowCreateModal(false)} 
                categories={categories.filter(c => c.slug !== 'all')} 
                onSuccess={() => { 
                  setShowCreateModal(false); 
                  setPosts([]);
                  setPage(1);
                  setHasMore(true);
                  fetchPosts(1, true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  toast.success('✅ Diskusi berhasil dibuat!');
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          MODAL 2: KOMENTAR
      ============================================ */}
      {selectedPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={(e) => e.target === e.currentTarget && closeCommentModal()}>
          <div ref={modalRef} className="bg-background w-full max-w-500 h-[80vh] sm:h-[600px] sm:w-[500px] rounded-2xl flex flex-col shadow-2xl animate-scale-up border border-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0 bg-background">
              <h3 className="font-bold text-base">Komentar</h3>
              <button onClick={closeCommentModal} className="p-2 hover:bg-surface rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-background scroll-smooth">
              {isCommentsLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Memuat komentar...</p>
                </div>
              ) : commentError ? (
                <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2 text-center px-4">
                  <AlertCircle className="w-10 h-10" />
                  <p className="text-sm font-medium">{commentError}</p>
                  <button onClick={() => fetchComments(selectedPostId)} className="text-xs underline mt-2 text-primary">Coba Lagi</button>
                </div>
              ) : modalComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-2">
                  <MessageSquare className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Belum ada komentar. Jadilah yang pertama!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {renderNestedComments(modalComments)}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border bg-background flex items-center gap-3 flex-shrink-0 relative z-10">
               {replyingTo && (
                 <div className="absolute bottom-full left-0 right-0 bg-surface p-2 text-xs flex justify-between items-center border-t border-border shadow-lg animate-slide-up">
                   <span className="truncate mr-2 ml-2">Membalas <strong>{replyingTo.user_name}</strong></span>
                   <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-red-100 rounded-full"><X className="w-3 h-3 text-red-500" /></button>
                 </div>
               )}
               
               <input 
                 type="text" 
                 value={commentInput}
                 onChange={(e) => setCommentInput(e.target.value)}
                 placeholder={replyingTo ? `Balas ke ${replyingTo.user_name}...` : "Tulis komentar..."}
                 className="flex-1 bg-surface border border-transparent focus:border-primary rounded-full px-4 py-2.5 text-sm focus:outline-none transition-all"
                 onKeyDown={(e) => e.key === 'Enter' && submitComment()}
               />
               <button 
                 onClick={submitComment}
                 disabled={!commentInput.trim() || isCommentsLoading}
                 className="text-primary font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed px-2"
               >
                 Kirim
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          MODAL 3: FILTER KATEGORI
      ============================================ */}
      {isFilterModalOpen && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsFilterModalOpen(false)}>
            <div className="bg-background w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up border border-border" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                  <h3 className="font-bold text-lg">Kategori Forum</h3>
                  <button onClick={() => setIsFilterModalOpen(false)} className="p-1 hover:bg-surface rounded"><X className="w-5 h-5"/></button>
               </div>
               <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                  {categories.map(c => (
                     <button key={c.slug} onClick={() => { setActiveCategory(c.slug); setIsFilterModalOpen(false); }} className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${activeCategory === c.slug ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:border-primary/50'}`}>
                        <span className="flex items-center gap-2"><span>{c.icon}</span> {c.name}</span>
                        {activeCategory === c.slug && <Check className="w-4 h-4"/>}
                     </button>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* ============================================
          MODAL 4: REPORT POST ✅ UPDATED dengan context snapshot
      ============================================ */}
      {showReportModal && reportTarget && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportTarget(null);
          }}
          reportedType="forum_post"
          reportedId={reportTarget.id}
          reportedName={reportTarget.title}
          contextSnapshot={{
            type: 'forum_post',
            id: reportTarget.id,
            title: reportTarget.title,
            content: reportTarget.content,
            author: {
              id: reportTarget.author_id,
              name: reportTarget.author_name,
              avatar: reportTarget.author_avatar,
            },
            category: reportTarget.category_name,
            images: reportTarget.images?.slice(0, 3).map(img => img.image_url) || [],
          }}
          onSuccess={() => {
            setShowReportModal(false);
            setReportTarget(null);
          }}
        />
      )}

      {/* ============================================
          MODAL 5: REPORT COMMENT ✅ UPDATED dengan context snapshot lengkap
      ============================================ */}
        {showCommentReportModal && commentReportTarget && (
          <ReportModal
            isOpen={showCommentReportModal}
            onClose={() => {
              setShowCommentReportModal(false);
              setCommentReportTarget(null);
            }}
            reportedType="comment"
            reportedId={commentReportTarget.comment.id}
            reportedName={`Komentar dari ${commentReportTarget.comment.user_name}`}
            contextSnapshot={{
              type: 'comment',
              id: commentReportTarget.comment.id,
              content: commentReportTarget.comment.content,
              author: {
                name: commentReportTarget.comment.user_name,
                avatar: commentReportTarget.comment.user_avatar,
              },
              parentPost: commentReportTarget.parentPost ? {
                id: commentReportTarget.parentPost.id,
                title: commentReportTarget.parentPost.title,
                content: commentReportTarget.parentPost.content.substring(0, 200),
              } : null,
            }}
            onSuccess={() => {
              setShowCommentReportModal(false);
              setCommentReportTarget(null);
            }}
          />
        )}
    </div> 
  );
}