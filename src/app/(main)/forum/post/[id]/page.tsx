'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Heart, MessageSquare, Share2, Bookmark, Send, AlertCircle,
  ChevronLeft, ChevronRight, Eye, Loader2, X, Flag, ArrowLeft
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { ReportModal } from '@/components/reports/ReportModal';
import { getCookie } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';

const IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect fill="%23f5f9f4" width="400" height="400"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';

interface Post {
  id: number;
  author_id: number;
  author_name: string;
  author_avatar: string | null;
  category_id: number;
  category_name: string;
  category_icon: string;
  title: string;
  content: string;
  views: number;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  images: Array<{
    id: number;
    image_url: string;
    image_alt: string;
  }>;
  created_at: string;
}

interface Comment {
  id: number;
  user_name: string;
  user_avatar: string | null;
  content: string;
  created_at: string;
  parent_id: number | null;
  like_count: number;
  replies?: Comment[];
}

export default function ForumPostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated } = useAuth();
  const postId = Number(params.id);

  // Post & Comments State
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Image Slider State
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ✅ Comment Modal State
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Like & Bookmark State
  const [isLiking, setIsLiking] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCommentReportModal, setShowCommentReportModal] = useState(false);
  const [commentReportTarget, setCommentReportTarget] = useState<Comment | null>(null);

  // Like Comment State
  const [likingCommentId, setLikingCommentId] = useState<number | null>(null);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<number>>(new Set());

  // ============================================
  // FETCH DATA
  // ============================================
  useEffect(() => {
    if (postId) {
      fetchPostDetail();
      fetchComments();
    }
  }, [postId]);

  const fetchPostDetail = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/forum/posts/${postId}`, { headers });

      if (!res.ok) throw new Error('Post tidak ditemukan');

      const data = await res.json();
      if (data.success) {
        setPost(data.post);
      }
    } catch (error: any) {
      console.error('Fetch post error:', error);
      toast.error(error.message || 'Gagal memuat post');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/forum/posts/${postId}/comments?sort=desc`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setComments(convertCommentTypes(data.comments || []));
        }
      }
    } catch (error) {
      console.error('Fetch comments error:', error);
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
      replies: c.replies ? convertCommentTypes(c.replies) : [],
    }));
  };

  // ============================================
  // IMAGE SLIDER HANDLERS
  // ============================================
  const nextImage = () => {
    if (!post?.images?.length) return;
    setCurrentImageIndex((prev) => (prev + 1) % post.images.length);
  };

  const prevImage = () => {
    if (!post?.images?.length) return;
    setCurrentImageIndex((prev) => (prev - 1 + post.images.length) % post.images.length);
  };

  // ============================================
  // ACTION HANDLERS
  // ============================================
  const handleLikePost = async () => {
    if (!post) return;
    if (!isAuthenticated) {
      toast.error('Silakan login untuk memberikan like');
      router.push('/login');
      return;
    }

    setIsLiking(true);

    // Optimistic update
    setPost({
      ...post,
      is_liked: !post.is_liked,
      like_count: post.is_liked ? post.like_count - 1 : post.like_count + 1,
    });

    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/forum/posts/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPost({
          ...post,
          is_liked: data.liked,
          like_count: data.like_count !== undefined ? data.like_count : post.like_count,
        });
        toast.success(data.liked ? '❤️ Disukai!' : '❌ Like dibatalkan');
      } else {
        // Rollback
        setPost({
          ...post,
          is_liked: !post.is_liked,
          like_count: post.is_liked ? post.like_count + 1 : post.like_count - 1,
        });
      }
    } catch (error) {
      console.error('Like error:', error);
      toast.error('Gagal memproses like');
      setPost({
        ...post,
        is_liked: !post.is_liked,
        like_count: post.is_liked ? post.like_count + 1 : post.like_count - 1,
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleBookmarkPost = async () => {
    if (!post) return;
    if (!isAuthenticated) {
      toast.error('Silakan login untuk menyimpan postingan');
      router.push('/login');
      return;
    }

    setIsBookmarking(true);
    setPost({ ...post, is_bookmarked: !post.is_bookmarked });

    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/forum/posts/${post.id}/bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPost({ ...post, is_bookmarked: data.bookmarked });
        toast.success(data.bookmarked ? '🔖 Disimpan!' : '❌ Bookmark dihapus');
      } else {
        setPost({ ...post, is_bookmarked: !post.is_bookmarked });
      }
    } catch (error) {
      console.error('Bookmark error:', error);
      toast.error('Gagal memproses bookmark');
      setPost({ ...post, is_bookmarked: !post.is_bookmarked });
    } finally {
      setIsBookmarking(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.content.substring(0, 100) + '...',
          url: shareUrl,
        });
        toast.success('✅ Berhasil dibagikan!');
      } catch (err: any) {
        if (err.name !== 'AbortError') copyToClipboard(shareUrl);
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('🔗 Link disalin!');
    } catch {
      toast.error('Gagal menyalin link');
    }
  };

  // ============================================
  // COMMENT HANDLERS
  // ============================================
  const openCommentModal = () => {
    setShowCommentModal(true);
    fetchComments(); // Refresh comments saat modal dibuka
  };

  const closeCommentModal = () => {
    setShowCommentModal(false);
    setReplyingTo(null);
    setCommentInput('');
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !post) return;
    if (!isAuthenticated) {
      toast.error('Silakan login untuk berkomentar');
      router.push('/login');
      return;
    }

    setIsSubmittingComment(true);

    try {
      const token = getCookie('accessToken');
      const payload: any = {
        content: commentInput,
        post_id: post.id,
        ...(replyingTo && { parent_id: replyingTo.id }),
      };

      const res = await fetch('/api/forum/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCommentInput('');
        setReplyingTo(null);
        toast.success('✅ Komentar berhasil dikirim!');
        fetchComments();
        setPost({ ...post, comment_count: post.comment_count + 1 });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal mengirim komentar');
      }
    } catch (err) {
      console.error('Submit comment error:', err);
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setIsSubmittingComment(false);
    }
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
      if (isCurrentlyLiked) newSet.delete(commentId);
      else newSet.add(commentId);
      return newSet;
    });

    setLikingCommentId(commentId);

    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/forum/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses like');

      setComments(prevComments => {
        const updateLikes = (comments: Comment[]): Comment[] => {
          return comments.map(c => {
            if (c.id === commentId) return { ...c, like_count: data.like_count };
            if (c.replies?.length) return { ...c, replies: updateLikes(c.replies) };
            return c;
          });
        };
        return updateLikes(prevComments);
      });

      toast.success(action === 'like' ? '❤️ Komentar disukai!' : '❌ Like dibatalkan');
    } catch (error: any) {
      console.error('Like comment error:', error);
      setLikedCommentIds(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyLiked) newSet.add(commentId);
        else newSet.delete(commentId);
        return newSet;
      });
      toast.error(error.message || 'Gagal memproses like');
    } finally {
      setLikingCommentId(null);
    }
  };

  const handleReportComment = (comment: Comment) => {
    setCommentReportTarget(comment);
    setShowCommentReportModal(true);
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: id });
    } catch {
      return dateString;
    }
  };

  // ============================================
  // RENDER NESTED COMMENTS
  // ============================================
  const renderNestedComments = (comments: Comment[], depth = 0) => {
    return comments.map((comment) => {
      const hasReplies = comment.replies && comment.replies.length > 0;
      const isLikedByUser = likedCommentIds.has(comment.id);

      return (
        <div key={comment.id} className={`${depth > 0 ? 'mt-3' : 'mb-4 last:mb-0'}`}>
          <div className={`flex gap-3 ${depth > 0 ? 'ml-6 sm:ml-8 border-l-2 border-border pl-4' : ''}`}>
            {/* Avatar - ✅ AMBIL DARI user_avatar (kolom avatar di tabel users) */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden border border-border">
              {comment.user_avatar ? (
                <img
                  src={comment.user_avatar}
                  alt={comment.user_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-text-primary">{comment.user_name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="bg-surface p-3 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm text-text-primary">{comment.user_name}</span>
                  <span className="text-[10px] text-text-secondary">{formatTime(comment.created_at)}</span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed break-words">{comment.content}</p>

                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={() => handleLikeComment(comment.id)}
                    disabled={likingCommentId === comment.id}
                    className={`text-xs flex items-center gap-1 transition-all disabled:opacity-50 ${
                      isLikedByUser ? 'text-red-500 font-medium' : 'text-text-secondary hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${isLikedByUser ? 'fill-red-500' : ''}`} />
                    {comment.like_count}
                  </button>

                  <button
                    onClick={() => setReplyingTo(comment)}
                    className="text-xs font-medium text-text-secondary hover:text-primary"
                  >
                    Balas
                  </button>

                  <button
                    onClick={() => handleReportComment(comment)}
                    className="text-xs text-text-secondary hover:text-red-500 ml-auto"
                    title="Laporkan komentar"
                  >
                    <Flag className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {hasReplies && (
                <div className="mt-2">
                  {renderNestedComments(comment.replies!, depth + 1)}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  // ============================================
  // LOADING & ERROR STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-16 h-16 text-text-secondary/30" />
        <p className="text-text-secondary">Post tidak ditemukan</p>
        <button onClick={() => router.push('/forum')} className="btn-primary">
          Kembali ke Forum
        </button>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="max-w-500x-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Kembali</span>
        </button>

        {/* Post Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
            ) : (
              post.author_name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary">{post.author_name}</p>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>{formatTime(post.created_at)}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {post.views || 0} dilihat
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            {post.category_icon} {post.category_name}
          </span>
        </div>

        {/* Post Title */}
        <h1 className="text-2xl font-bold text-text-primary mb-4">{post.title}</h1>

        {/* ✅ IMAGE SLIDER */}
        {post.images && post.images.length > 0 && (
          <div className="mb-4 rounded-xl overflow-hidden border border-border relative bg-black">
            {/* Main Image */}
            <div className="relative aspect-square w-full">
              <img
                src={post.images[currentImageIndex]?.image_url || IMAGE_PLACEHOLDER}
                alt={post.images[currentImageIndex]?.image_alt || post.title}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER;
                }}
              />

              {/* Navigation Buttons */}
              {post.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Image Counter */}
              {post.images.length > 1 && (
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                  {currentImageIndex + 1} / {post.images.length}
                </div>
              )}
            </div>

            {/* Indicator Dots */}
            {post.images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {post.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Post Content */}
        <div className="mb-6">
          <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{post.content}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between py-4 border-y border-border mb-6">
          <div className="flex items-center gap-6">
            <button
              onClick={handleLikePost}
              disabled={isLiking}
              className={`flex items-center gap-2 transition-all disabled:opacity-50 ${
                post.is_liked ? 'text-red-500' : 'text-text-primary hover:text-red-500'
              }`}
            >
              <Heart className={`w-6 h-6 ${post.is_liked ? 'fill-current' : ''}`} />
              <span className="font-semibold">{post.like_count.toLocaleString()}</span>
            </button>

            {/* ✅ Tombol Komentar buka modal */}
            <button
              onClick={openCommentModal}
              className="flex items-center gap-2 text-text-primary hover:text-primary transition-colors"
            >
              <MessageSquare className="w-6 h-6" />
              <span className="font-semibold">{post.comment_count.toLocaleString()}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 text-text-primary hover:text-primary"
            >
              <Share2 className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReportModal(true)}
              className="text-text-secondary hover:text-red-500 transition-colors"
              title="Laporkan postingan"
            >
              <Flag className="w-5 h-5" />
            </button>
            <button
              onClick={handleBookmarkPost}
              disabled={isBookmarking}
              className={`transition-all disabled:opacity-50 ${
                post.is_bookmarked ? 'text-primary' : 'text-text-primary hover:text-primary'
              }`}
            >
              <Bookmark className={`w-6 h-6 ${post.is_bookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Comment Preview */}
        <div className="mb-6">
          <button
            onClick={openCommentModal}
            className="w-full text-left p-4 bg-surface rounded-xl hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-2 text-text-secondary">
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm">
                {post.comment_count > 0
                  ? `Lihat semua ${post.comment_count} komentar`
                  : 'Jadilah yang pertama berkomentar!'}
              </span>
            </div>
          </button>
        </div>
      </main>

      {/* ✅ COMMENT MODAL */}
      {showCommentModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closeCommentModal}
        >
          <div
            className="bg-background w-full sm:max-w-150 h-[85vh] sm:h-[600px] sm:rounded-2xl rounded-t-2xl flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <h3 className="font-bold text-lg text-text-primary">
                Komentar ({post.comment_count})
              </h3>
              <button
                onClick={closeCommentModal}
                className="p-2 hover:bg-surface rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments List - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {comments.length > 0 ? (
                <div className="space-y-2">{renderNestedComments(comments)}</div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary">
                  <MessageSquare className="w-16 h-16 opacity-20 mb-3" />
                  <p className="font-medium">Belum ada komentar</p>
                  <p className="text-sm mt-1">Jadilah yang pertama berkomentar!</p>
                </div>
              )}
            </div>

            {/* Comment Input - Inside Modal */}
            <div className="border-t border-border p-3 flex-shrink-0 bg-background">
              {replyingTo && (
                <div className="bg-surface p-2 text-xs flex justify-between items-center border-b border-border mb-2 rounded-lg">
                  <span className="truncate">
                    Membalas <strong>{replyingTo.user_name}</strong>
                  </span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* ✅ Avatar dari tabel users kolom avatar */}
                
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={replyingTo ? `Balas ke ${replyingTo.user_name}...` : 'Tulis komentar...'}
                  className="flex-1 bg-surface border border-transparent focus:border-primary rounded-full px-4 py-2.5 text-sm focus:outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                  disabled={!isAuthenticated || isSubmittingComment}
                />
                <button
                  onClick={submitComment}
                  disabled={!commentInput.trim() || isSubmittingComment || !isAuthenticated}
                  className="text-primary font-semibold text-sm disabled:opacity-50 px-2"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Post Modal */}
      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedType="forum_post"
          reportedId={post.id}
          reportedName={post.title}
          contextSnapshot={{
            type: 'forum_post',
            id: post.id,
            title: post.title,
            content: post.content,
            author: {
              id: post.author_id,
              name: post.author_name,
              avatar: post.author_avatar,
            },
            category: post.category_name,
          }}
          onSuccess={() => setShowReportModal(false)}
        />
      )}

      {/* Report Comment Modal */}
      {showCommentReportModal && commentReportTarget && (
        <ReportModal
          isOpen={showCommentReportModal}
          onClose={() => {
            setShowCommentReportModal(false);
            setCommentReportTarget(null);
          }}
          reportedType="comment"
          reportedId={commentReportTarget.id}
          reportedName={`Komentar dari ${commentReportTarget.user_name}`}
          contextSnapshot={{
            type: 'comment',
            id: commentReportTarget.id,
            content: commentReportTarget.content,
            author: {
              name: commentReportTarget.user_name,
              avatar: commentReportTarget.user_avatar,
            },
            parentPost: {
              id: post.id,
              title: post.title,
            },
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