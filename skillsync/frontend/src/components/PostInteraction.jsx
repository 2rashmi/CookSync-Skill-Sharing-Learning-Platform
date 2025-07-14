import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import '../styles/PostInteraction.css';
import '../styles/Icons.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// API base URL configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const PostInteraction = ({ post, onUpdate, highlightCommentId: propHighlightCommentId, notificationType }) => {
  const { user, checkAuthStatus } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [highlightedComment, setHighlightedComment] = useState(null);
  const commentRefs = useRef({});
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedComments, setExpandedComments] = useState(new Set());

  // Get commentId from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const urlCommentId = searchParams.get('commentId');
  const highlightCommentId = propHighlightCommentId || urlCommentId;

  useEffect(() => {
    fetchComments();
    checkIfLiked();
  }, [post.id, user?.id]);

  // Handle comment highlighting and scrolling
  useEffect(() => {
    if (highlightCommentId) {
      const highlightComment = async () => {
        try {
          // First ensure comments are loaded
          if (!comments.length) {
            await fetchComments();
            // Wait for comments to be loaded and rendered
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Find the comment to highlight - check both main comments and replies
          const commentToHighlight = comments.find(c => c.id === highlightCommentId) ||
            comments.flatMap(c => c.replies || []).find(r => r.id === highlightCommentId);

          if (commentToHighlight) {
            // If it's a reply, make sure the parent comment is expanded
            if (commentToHighlight.parentCommentId) {
              const parentComment = comments.find(c => c.id === commentToHighlight.parentCommentId);
              if (parentComment) {
                // Expand the parent comment
                setExpandedComments(prev => new Set([...prev, parentComment.id]));
                // Wait for the parent comment to expand
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }

            // Function to attempt scrolling
            const attemptScroll = () => {
              const commentElement = document.getElementById(`comment-${commentToHighlight.id}`);
              if (commentElement) {
                const headerOffset = 80;
                const elementPosition = commentElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                  top: offsetPosition,
                  behavior: 'smooth'
                });

                commentElement.classList.add('highlight-comment');
                setTimeout(() => {
                  commentElement.classList.remove('highlight-comment');
                }, 2000);
                return true;
              }
              return false;
            };

            // Try scrolling immediately
            if (!attemptScroll()) {
              // If first attempt fails, retry with increasing delays
              const retryDelays = [500, 1000, 1500];
              for (const delay of retryDelays) {
                await new Promise(resolve => setTimeout(resolve, delay));
                if (attemptScroll()) {
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error highlighting comment:', error);
        }
      };

      highlightComment();
    }
  }, [highlightCommentId, comments, expandedComments, notificationType]);

  // Add CSS for highlight animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .highlight-comment {
        animation: highlight-pulse 2s ease-in-out;
      }
      @keyframes highlight-pulse {
        0% { background-color: rgba(255, 255, 0, 0.2); }
        50% { background-color: rgba(255, 255, 0, 0.4); }
        100% { background-color: transparent; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Update like count when post changes
  useEffect(() => {
    setLikeCount(post.likes || 0);
  }, [post.likes]);

  const fetchComments = async () => {
    if (!post.id) return;
    
    try {
      const response = await axios.get(`/api/interactions/posts/${post.id}/comments`);
      // Calculate reply counts for each comment
      const commentsWithReplyCounts = response.data.map(comment => {
        const replyCount = response.data.filter(reply => 
          reply.parentCommentId === comment.id
        ).length;
        return {
          ...comment,
          replyCount,
          replies: response.data
            .filter(reply => reply.parentCommentId === comment.id)
            .map(reply => reply.id)
        };
      });
      setComments(commentsWithReplyCounts);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments. Please try again.');
    }
  };

  const checkIfLiked = async () => {
    if (!user || !post.id) return;
    try {
      const response = await axios.get(`/api/posts/${post.id}/likes/check`);
      setIsLiked(response.data.liked);
    } catch (error) {
      console.error('Error checking like status:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        // If unauthorized, try to refresh auth status
        await checkAuthStatus();
      }
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('Please log in to like posts');
      navigate('/login');
      return;
    }

    if (!post.id) {
      console.error('Post ID is undefined:', post);
      toast.error('Cannot like this post. Post ID is missing.');
      return;
    }

    if (!user.id) {
      console.error('User ID is undefined:', user);
      toast.error('Cannot like this post. User ID is missing.');
      return;
    }

    try {
      setIsLikeLoading(true);
      console.log('Sending like request for post:', post.id, 'user:', user.id);
      
      // First check if the user exists in the database
      try {
        const userResponse = await axios.get(`/api/users/${user.id}`);
        console.log('User found:', userResponse.data);
      } catch (userError) {
        console.error('Error checking user:', userError);
        // If user doesn't exist, create them
        try {
          // Make sure we have all required fields
          if (!user.name || !user.email) {
            console.error('Missing user data:', user);
            toast.error('Cannot create user account. Missing required information.');
            setIsLikeLoading(false);
            return;
          }
          
          console.log('Creating user with data:', {
            id: user.id,
            name: user.name,
            email: user.email
          });
          
          const createUserResponse = await axios.post('/api/users', {
            id: user.id,
            name: user.name,
            email: user.email
          });
          
          console.log('User created:', createUserResponse.data);
        } catch (createError) {
          console.error('Error creating user:', createError);
          console.error('Error response:', createError.response?.data);
          toast.error(createError.response?.data?.message || 'Failed to create user account. Please try again.');
          setIsLikeLoading(false);
          return;
        }
      }
      
      // Now proceed with the like
      const response = await axios.post(`/api/interactions/posts/${post.id}/likes`, null, {
        params: { userId: user.id }
      });
      
      console.log('Like response:', response.data);
      
      if (response.data.success) {
        // Toggle the like state
        const newIsLiked = !isLiked;
        setIsLiked(newIsLiked);
        
        // Update the like count
        const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1;
        setLikeCount(newLikeCount);
        
        // Update the post object
        if (onUpdate) {
          const updatedPost = { ...post, likes: newLikeCount };
          onUpdate(updatedPost);
        }
        
        toast.success(newIsLiked ? 'Post liked!' : 'Post unliked');
      } else {
        console.error('Failed to update like:', response.data.message);
        toast.error(response.data.message || 'Failed to update like. Please try again.');
      }
    } catch (error) {
      console.error('Error updating like:', error);
      console.error('Error response:', error.response?.data);
      if (error.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to update like. Please try again.');
      }
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to comment');
      navigate('/login');
      return;
    }
    
    if (!newComment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    
    try {
      const response = await axios.post(`/api/interactions/posts/${post.id}/comments`, 
        { content: newComment },
        {
          params: {
            userId: user.id,
            userName: user.name,
            userPicture: user.picture
          }
        }
      );
      setNewComment('');
      fetchComments();
      if (onUpdate) onUpdate();
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment. Please try again.');
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editCommentText.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    
    try {
      const response = await axios.put(
        `/api/posts/${post.id}/comments/${commentId}`,
        { content: editCommentText },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Update the comments list with the edited comment
      setComments(comments.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, content: editCommentText, updatedAt: new Date().toISOString() };
        }
        return comment;
      }));
      
      setEditingComment(null);
      setEditCommentText('');
      
      if (onUpdate) onUpdate();
      toast.success('Comment updated successfully');
    } catch (error) {
      console.error('Error editing comment:', error);
      toast.error('Failed to update comment. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      // Check if user is logged in
      if (!user) {
        toast.error('Please log in to delete comments');
        navigate('/login');
        return;
      }

      const commentToDelete = comments.find(c => c.id === commentId);
      if (!commentToDelete) {
        toast.error('Comment not found');
        return;
      }

      // Check if user is authorized to delete the comment
      const isAuthorized = user?.id === commentToDelete.userId || user?.id === post.userId;
      if (!isAuthorized) {
        toast.error('You are not authorized to delete this comment');
        return;
      }

      const isReply = commentToDelete?.parentCommentId != null;
      
      // Use the correct API endpoint for deleting comments
      const response = await axios.delete(`/api/interactions/posts/${post.id}/comments/${commentId}`, {
        headers: {
          'Authorization': `Bearer ${user.id}`
        },
        withCredentials: true
      });

      if (response.status === 401) {
        // Session expired, try to refresh auth status
        await checkAuthStatus();
        toast.error('Your session has expired. Please try again.');
        return;
      }
      
      // Update the comments list and handle reply count
      setComments(prevComments => {
        // First remove the deleted comment
        const updatedComments = prevComments.filter(comment => comment.id !== commentId);
        
        // If it's a reply, update the parent comment's reply count
        if (isReply && commentToDelete) {
          return updatedComments.map(comment => {
            if (comment.id === commentToDelete.parentCommentId) {
              // Recalculate reply count for this parent comment
              const newReplyCount = updatedComments.filter(reply => 
                reply.parentCommentId === comment.id
              ).length;
              
              return {
                ...comment,
                replyCount: newReplyCount,
                replies: updatedComments
                  .filter(reply => reply.parentCommentId === comment.id)
                  .map(reply => reply.id)
              };
            }
            return comment;
          });
        }
        
        return updatedComments;
      });
      
      if (onUpdate) onUpdate();
      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      
      if (error.response?.status === 401) {
        // Session expired
        toast.error('Your session has expired. Please log in again.');
        navigate('/login');
      } else if (error.response?.status === 403) {
        // Not authorized
        toast.error('You are not authorized to delete this comment');
      } else {
        toast.error('Failed to delete comment. Please try again.');
      }
    }
  };

  const handleShare = async () => {
    try {
      // Create the specific post URL
      const postUrl = `${window.location.origin}/posts/${post.id}`;
      
      if (navigator.share) {
        const shareData = {
          title: post.title,
          text: post.description,
          url: postUrl
        };
        
        try {
          const result = await navigator.share(shareData);
          // Only show success if we get a result back
          if (result) {
            toast.success('Shared successfully');
          }
        } catch (error) {
          // Check if the error is due to user cancellation
          if (error.name === 'AbortError') {
            // User cancelled the share dialog, do nothing
            return;
          }
          // For other errors, throw to be caught by outer catch
          throw error;
        }
      } else {
        // Fallback for browsers that don't support Web Share API
        try {
          await navigator.clipboard.writeText(postUrl);
          toast.success('Post link copied to clipboard!');
        } catch (error) {
          console.error('Error copying to clipboard:', error);
          toast.error('Failed to copy link. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share. Please try again.');
    }
  };

  const handleAddReply = async (commentId) => {
    if (!user) {
      toast.error('Please log in to reply');
      navigate('/login');
      return;
    }
    
    if (!replyText.trim()) {
      toast.error('Reply cannot be empty');
      return;
    }
    
    try {
      const response = await axios.post(`/api/posts/${post.id}/comments`, 
        { 
          content: replyText,
          parentCommentId: commentId
        },
        {
          params: {
            userId: user.id,
            userName: user.name,
            userPicture: user.picture
          }
        }
      );
      
      // Update the comments list with the new reply
      setComments(prevComments => {
        const newComment = response.data;
        const updatedComments = [...prevComments, newComment];
        
        // Update parent comment's reply count
        return updatedComments.map(comment => {
          if (comment.id === commentId) {
            const newReplyCount = updatedComments.filter(reply => 
              reply.parentCommentId === comment.id
            ).length;
            
            return {
              ...comment,
              replyCount: newReplyCount,
              replies: updatedComments
                .filter(reply => reply.parentCommentId === comment.id)
                .map(reply => reply.id)
            };
          }
          return comment;
        });
      });
      
      setReplyText('');
      setReplyingTo(null);
      if (onUpdate) onUpdate();
      toast.success('Reply added successfully');
    } catch (error) {
      console.error('Error adding reply:', error);
      toast.error('Failed to add reply. Please try again.');
    }
  };

  const toggleReplies = async (commentId) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    } else {
      try {
        const response = await axios.get(`/api/posts/${post.id}/comments/${commentId}/replies`);
        setComments(comments.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              replies: response.data.map(reply => reply.id)
            };
          }
          return comment;
        }));
        setExpandedReplies(prev => new Set(prev).add(commentId));
      } catch (error) {
        console.error('Error fetching replies:', error);
        toast.error('Failed to load replies');
      }
    }
  };

  const renderComment = (comment) => {
    const isExpanded = expandedReplies.has(comment.id);
    const hasReplies = comment.replyCount > 0;
    const isHighlighted = highlightedComment === comment.id;

    return (
      <div 
        key={comment.id} 
        id={`comment-${comment.id}`}
        className={`comment ${isHighlighted ? 'highlighted' : ''} ${comment.parentCommentId ? 'reply' : ''}`}
        ref={el => {
          if (el) {
            commentRefs.current[comment.id] = el;
            // If this is the highlighted comment, ensure it's visible
            if (isHighlighted) {
              const headerOffset = 80;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
              });
            }
          }
        }}
      >
        <div className="comment-header">
          <span className="comment-author">{comment.userName || 'Anonymous'}</span>
          <span className="comment-time">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>
        
        <div className="comment-content">
          {editingComment === comment.id ? (
            <div className="edit-comment">
              <input
                type="text"
                value={editCommentText}
                onChange={(e) => setEditCommentText(e.target.value)}
                className="edit-comment-input"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleEditComment(comment.id);
                  }
                }}
              />
              <div className="edit-comment-buttons">
                <button 
                  onClick={() => handleEditComment(comment.id)}
                  className="save-button"
                  type="button"
                >
                  Save
                </button>
                <button 
                  onClick={() => {
                    setEditingComment(null);
                    setEditCommentText('');
                  }}
                  className="cancel-button"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p>{comment.content}</p>
              <div className="comment-actions">
                <button 
                  onClick={() => setReplyingTo(comment.id)}
                  className="icon-button"
                  title="Reply to comment"
                >
                  <span className="material-icons md-animate reply">reply</span>
                  Reply
                </button>
                {hasReplies && (
                  <button 
                    onClick={() => toggleReplies(comment.id)}
                    className="icon-button"
                  >
                    <span className="material-icons md-animate">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                    {comment.replyCount} {comment.replyCount === 1 ? 'Reply' : 'Replies'}
                  </button>
                )}
                {(user?.id === comment.userId || user?.id === post.userId) && (
                  <>
                    {user?.id === comment.userId && (
                      <button 
                        onClick={() => {
                          setEditingComment(comment.id);
                          setEditCommentText(comment.content);
                        }}
                        className="icon-button"
                        title="Edit comment"
                      >
                        <span className="material-icons md-animate edit">edit</span>
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteComment(comment.id)}
                      className="icon-button"
                      title="Delete comment"
                    >
                      <span className="material-icons md-animate delete">delete</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {replyingTo === comment.id && (
          <div className="reply-form">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="reply-input"
            />
            <div className="reply-actions">
              <button 
                onClick={() => handleAddReply(comment.id)}
                className="submit-reply"
                disabled={!replyText.trim()}
              >
                Reply
              </button>
              <button 
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
                className="cancel-reply"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="replies-section">
            {comments
              .filter(reply => reply.parentCommentId === comment.id)
              .map(reply => renderComment(reply))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="post-interaction">
      <div className="interaction-buttons">
        <button 
          className={`icon-button ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={isLikeLoading}
        >
          <span className="material-icons md-animate like">
            {isLiked ? 'favorite' : 'favorite_border'}
          </span>
          <span>{likeCount}</span>
        </button>
        
        <button className="icon-button">
          <span className="material-icons md-animate comment">comment</span>
          <span>{comments.length}</span>
        </button>

        <button className="icon-button" onClick={handleShare}>
          <span className="material-icons md-animate share">share</span>
        </button>
      </div>

      <div className="comments-section">
        <form onSubmit={handleAddComment} className="add-comment">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="comment-input"
          />
          <button type="submit" className="submit-comment">
            Post
          </button>
        </form>

        <div className="comments-list">
          {comments
            .filter(comment => !comment.parentCommentId)
            .map(renderComment)}
        </div>
      </div>
    </div>
  );
};

export default PostInteraction; 