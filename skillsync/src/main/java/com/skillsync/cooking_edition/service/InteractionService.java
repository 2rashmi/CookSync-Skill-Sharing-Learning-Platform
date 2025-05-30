package com.skillsync.cooking_edition.service;

import com.skillsync.cooking_edition.model.*;
import com.skillsync.cooking_edition.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class InteractionService {

    private static final Logger logger = LoggerFactory.getLogger(InteractionService.class);

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private LikeRepository likeRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Transactional
    public void toggleLike(String postId, String userId) {
        try {
            logger.info("Service: Toggling like for post: {} and user: {}", postId, userId);
            
            // Find post
            Post post = postRepository.findById(postId)
                    .orElseThrow(() -> new RuntimeException("Post not found: " + postId));
            
            // Find user
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userId));
            
            // Check if like exists
            Like existingLike = likeRepository.findByPostIdAndUserId(postId, userId);
            
            if (existingLike != null) {
                // Unlike
                logger.info("Service: Removing like for post: {} and user: {}", postId, userId);
                likeRepository.delete(existingLike);
                post.setLikes(post.getLikes() - 1);
            } else {
                // Like
                logger.info("Service: Adding like for post: {} and user: {}", postId, userId);
                Like like = new Like();
                like.setPostId(postId);
                like.setUserId(userId);
                likeRepository.save(like);
                post.setLikes(post.getLikes() + 1);

                // Create notification for post owner
                if (!post.getUserId().equals(userId)) { // Don't notify if user liked their own post
                    Notification notification = new Notification();
                    notification.setUserId(post.getUserId());
                    notification.setSenderId(userId);
                    notification.setSenderName(user.getName());
                    notification.setMessage(user.getName() + " liked your post");
                    notification.setType(Notification.NotificationType.LIKE);
                    notification.setRelatedPostId(postId);
                    notification.setCreatedAt(LocalDateTime.now());
                    notification.setRead(false);
                    notificationRepository.save(notification);
                    logger.info("Service: Created notification for post owner: {}", post.getUserId());
                }
            }

            // Save updated post
            postRepository.save(post);
            logger.info("Service: Successfully toggled like for post: {} and user: {}", postId, userId);
        } catch (Exception e) {
            logger.error("Service: Error toggling like for post: {} and user: {}", postId, userId, e);
            throw e; // Re-throw to be handled by the controller
        }
    }

    public boolean isLiked(String postId, String userId) {
        return likeRepository.findByPostIdAndUserId(postId, userId) != null;
    }

    public Comment addComment(String postId, String userId, String content) {
        return addComment(postId, userId, content, null);
    }

    public Comment addComment(String postId, String userId, String content, String parentCommentId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Comment comment = new Comment();
        comment.setPostId(postId);
        comment.setUserId(userId);
        comment.setUserName(user.getName());
        comment.setContent(content);
        comment.setCreatedAt(LocalDateTime.now());
        comment.setUpdatedAt(LocalDateTime.now());
        
        if (parentCommentId != null) {
            Comment parentComment = commentRepository.findById(parentCommentId)
                    .orElseThrow(() -> new RuntimeException("Parent comment not found"));
            comment.setParentCommentId(parentCommentId);
            parentComment.addReply(comment.getId());
            commentRepository.save(parentComment);
            logger.info("Added reply to parent comment: {}", parentCommentId);
        }

        Comment savedComment = commentRepository.save(comment);
        logger.info("Saved comment: {}", savedComment.getId());

        // Update post comment count
        post.setComments(post.getComments() + 1);
        postRepository.save(post);
        logger.info("Updated post comment count: {}", post.getComments());

        // Create notification
        String notificationUserId;
        String notificationMessage;
        Notification.NotificationType notificationType;

        if (parentCommentId != null) {
            // This is a reply, notify the parent comment's author
            Comment parentComment = commentRepository.findById(parentCommentId).get();
            notificationUserId = parentComment.getUserId();
            notificationMessage = user.getName() + " replied to your comment";
            notificationType = Notification.NotificationType.REPLY;
            logger.info("Creating reply notification for comment author: {}", notificationUserId);
        } else {
            // This is a regular comment, notify the post owner
            notificationUserId = post.getUserId();
            notificationMessage = user.getName() + " commented on your post";
            notificationType = Notification.NotificationType.COMMENT;
            logger.info("Creating comment notification for post owner: {}", notificationUserId);
        }

        // Don't notify if the user is commenting on their own post/comment
        if (!notificationUserId.equals(userId)) {
            try {
        Notification notification = new Notification();
                notification.setUserId(notificationUserId);
        notification.setSenderId(userId);
        notification.setSenderName(user.getName());
                notification.setMessage(notificationMessage);
                notification.setType(notificationType);
        notification.setRelatedPostId(postId);
                notification.setRelatedCommentId(savedComment.getId());
        notification.setCreatedAt(LocalDateTime.now());
        notification.setRead(false);
                Notification savedNotification = notificationRepository.save(notification);
                logger.info("Created notification: {} for user: {}", savedNotification.getId(), notificationUserId);
            } catch (Exception e) {
                logger.error("Failed to create notification: {}", e.getMessage(), e);
            }
        } else {
            logger.info("Skipping notification - user commented on their own content");
        }

        return savedComment;
    }

    public List<Comment> getComments(String postId) {
        return commentRepository.findByPostId(postId);
    }

    public List<Comment> getCommentReplies(String commentId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));
        return commentRepository.findByParentCommentId(commentId);
    }

    public Comment getCommentById(String commentId) {
        return commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));
    }

    public Comment updateComment(Comment comment) {
        return commentRepository.save(comment);
    }

    public void deleteComment(String commentId) {
        Comment comment = getCommentById(commentId);
        Post post = postRepository.findById(comment.getPostId())
                .orElseThrow(() -> new RuntimeException("Post not found"));
        
        // If this is a reply, update the parent comment's reply count
        if (comment.getParentCommentId() != null) {
            Comment parentComment = commentRepository.findById(comment.getParentCommentId())
                    .orElseThrow(() -> new RuntimeException("Parent comment not found"));
            parentComment.removeReply(commentId);
            commentRepository.save(parentComment);
        }
        
        // Update post comment count
        post.setComments(post.getComments() - 1);
        postRepository.save(post);
        
        commentRepository.deleteById(commentId);
    }

    public List<Notification> getUserNotifications(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<Notification> getUnreadNotifications(String userId) {
        return notificationRepository.findByUserIdAndIsReadFalse(userId);
    }

    public void markNotificationAsRead(String notificationId, String userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (!notification.getUserId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }

        notification.setRead(true);
        notificationRepository.save(notification);
    }
} 