import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Divider,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  useTheme,
  useMediaQuery,
  Alert,
  Snackbar,
  Button,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import axios from 'axios';
import PostInteraction from '../components/PostInteraction';
import Post from '../components/Post';
import { useInView } from 'react-intersection-observer';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { useAuth } from '../contexts/AuthContext';
import LockIcon from '@mui/icons-material/Lock';
import UserSearch from '../components/UserSearch';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

const Community = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  
  const [posts, setPosts] = useState([]);
  const [followingPosts, setFollowingPosts] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [error, setError] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('error');
  const [followStatus, setFollowStatus] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  
  const { ref, inView } = useInView({
    threshold: 0,
  });

  const categories = [
    { id: 'all', label: 'All Posts', icon: '🌐', color: 'primary' },
    { id: 'breakfast', label: 'Breakfast', icon: '🍳', color: 'warning' },
    { id: 'lunch', label: 'Lunch', icon: '🥪', color: 'success' },
    { id: 'dinner', label: 'Dinner', icon: '🍽', color: 'error' },
    { id: 'dessert', label: 'Dessert', icon: '🍰', color: 'secondary' },
    { id: 'snacks', label: 'Snacks', icon: '🥨', color: 'info' },
    { id: 'vegetarian', label: 'Vegetarian', icon: '🥗', color: 'success' },
    { id: 'vegan', label: 'Vegan', icon: '🌱', color: 'success' },
    { id: 'gluten-free', label: 'Gluten Free', icon: '🌾', color: 'warning' }
  ];

  const showError = (message) => {
    setError(message);
    setSnackbarMessage(message);
    setSnackbarSeverity('error');
    setSnackbarOpen(true);
  };

  const showSuccess = (message) => {
    setSnackbarMessage(message);
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/posts?page=${page}&category=${selectedCategory}`);
      const fetchedPosts = response.data.content || response.data;
      
      if (!Array.isArray(fetchedPosts)) {
        throw new Error('Invalid response format from server');
      }
      
      // Sort posts by creation date in descending order (newest first)
      const sortedPosts = fetchedPosts.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      setPosts(sortedPosts);
      setHasMore(response.data.content ? response.data.content.length > 0 : false);
    } catch (error) {
      console.error('Error fetching posts:', error);
      showError(error.response?.data?.message || 'Failed to load posts. Please try again later.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [page, selectedCategory]);

  const fetchFollowingPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/posts/following');
      const fetchedPosts = response.data;
      
      if (!Array.isArray(fetchedPosts)) {
        throw new Error('Invalid response format from server');
      }
      
      // Sort posts by creation date in descending order (newest first)
      const sortedPosts = fetchedPosts.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      setFollowingPosts(sortedPosts);
    } catch (error) {
      console.error('Error fetching following posts:', error);
      showError('Failed to load posts from followed users. Please try again later.');
      setFollowingPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrendingPosts = useCallback(async () => {
    try {
      const response = await axios.get('/api/posts/trending');
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format from server');
      }
      setTrendingPosts(response.data);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      showError('Failed to load trending posts');
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await axios.get(`/api/posts?page=${nextPage}&category=${selectedCategory}`);
      const newPosts = response.data.content || response.data;
      
      if (!Array.isArray(newPosts)) {
        throw new Error('Invalid response format from server');
      }
      
      if (newPosts.length > 0) {
        // Sort new posts by creation date in descending order
        const sortedNewPosts = newPosts.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        setPosts(prevPosts => [...prevPosts, ...sortedNewPosts]);
        setPage(nextPage);
        setHasMore(true);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more posts:', error);
      showError('Failed to load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, selectedCategory]);

  useEffect(() => {
    if (activeTab === 0) {
      fetchPosts();
    } else {
      fetchFollowingPosts();
    }
    fetchTrendingPosts();
  }, [activeTab, fetchPosts, fetchFollowingPosts, fetchTrendingPosts]);

  useEffect(() => {
    if (inView && hasMore && !loadingMore && activeTab === 0) {
      loadMorePosts();
    }
  }, [inView, hasMore, loadingMore, loadMorePosts, activeTab]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setPage(1);
    setPosts([]);
    setLoading(true);
    fetchPosts();
  };

  const handlePostUpdate = () => {
    // Reset to first page and fetch fresh posts when a new post is created
    setPage(1);
    fetchPosts();
    fetchFollowingPosts();
    fetchTrendingPosts();
    showSuccess('Post updated successfully');
  };

  const handleFollow = async (userId) => {
    try {
      await axios.post(`/api/users/${userId}/follow`);
      setFollowStatus(prev => ({ ...prev, [userId]: true }));
      showSuccess('Successfully followed user');
      // Refresh following posts after following a user
      fetchFollowingPosts();
    } catch (error) {
      console.error('Error following user:', error);
      showError(error.response?.data?.message || 'Failed to follow user');
    }
  };

  const handleUnfollow = async (userId) => {
    try {
      await axios.delete(`/api/users/${userId}/follow`);
      setFollowStatus(prev => ({ ...prev, [userId]: false }));
      showSuccess('Successfully unfollowed user');
      // Refresh following posts after unfollowing a user
      fetchFollowingPosts();
    } catch (error) {
      console.error('Error unfollowing user:', error);
      showError(error.response?.data?.message || 'Failed to unfollow user');
    }
  };

  const checkFollowStatus = async (userId) => {
    try {
      const response = await axios.get(`/api/users/${userId}/follow-status`);
      setFollowStatus(prev => ({ ...prev, [userId]: response.data.isFollowing }));
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  useEffect(() => {
    // Check follow status for each post's user
    const postsToCheck = activeTab === 0 ? posts : followingPosts;
    postsToCheck.forEach(post => {
      if (post.userId !== user?.sub) {
        checkFollowStatus(post.userId);
      }
    });
  }, [posts, followingPosts, user, activeTab]);

  const filteredPosts = posts.filter(post => {
    const searchLower = searchQuery.toLowerCase();
    const descriptionLower = post.description?.toLowerCase() || '';
    const titleLower = post.title?.toLowerCase() || '';
    
    // Check if the search query matches username
    const matchesSearch = post.userName.toLowerCase().includes(searchLower);
    
    // Check if the category matches in title, description, or category field
    const matchesCategory = selectedCategory === 'all' || 
      (selectedCategory !== 'all' && (
        titleLower.includes(selectedCategory.toLowerCase()) ||
        descriptionLower.includes(selectedCategory.toLowerCase()) ||
        post.category?.toLowerCase() === selectedCategory.toLowerCase()
      ));
    
    return matchesSearch && matchesCategory;
  });

  const filteredFollowingPosts = followingPosts.filter(post => {
    const searchLower = searchQuery.toLowerCase();
    const descriptionLower = post.description?.toLowerCase() || '';
    const titleLower = post.title?.toLowerCase() || '';
    
    // Check if the search query matches username
    const matchesSearch = post.userName.toLowerCase().includes(searchLower);
    
    // Check if the category matches in title, description, or category field
    const matchesCategory = selectedCategory === 'all' || 
      (selectedCategory !== 'all' && (
        titleLower.includes(selectedCategory.toLowerCase()) ||
        descriptionLower.includes(selectedCategory.toLowerCase()) ||
        post.category?.toLowerCase() === selectedCategory.toLowerCase()
      ));
    
    return matchesSearch && matchesCategory;
  });

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    
    // Clear any existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set a new timeout to debounce the search
    const timeout = setTimeout(() => {
      if (activeTab === 0) {
        fetchPosts();
      } else {
        fetchFollowingPosts();
      }
    }, 300);
    
    setSearchTimeout(timeout);
  };

  const renderPost = (post) => (
    <Card key={post.id} sx={{ mb: 3, borderRadius: 2, boxShadow: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            alt={post.userName}
            src={post.userPicture}
            sx={{ 
              mr: 2, 
              cursor: 'pointer',
              width: 48,
              height: 48,
              bgcolor: post.userPicture ? 'transparent' : 'primary.main',
              '&:hover': {
                transform: 'scale(1.05)',
                transition: 'transform 0.2s ease-in-out'
              }
            }}
            onClick={() => navigate(`/users/${post.userId}`)}
          >
            {!post.userPicture && post.userName?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                cursor: 'pointer',
                fontWeight: 600,
                '&:hover': {
                  color: 'primary.main'
                }
              }}
              onClick={() => navigate(`/users/${post.userId}`)}
            >
              {post.userName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </Typography>
          </Box>
          {user && user.sub !== post.userId && (
            <Button
              variant="outlined"
              size="small"
              color={followStatus[post.userId] ? "error" : "primary"}
              startIcon={followStatus[post.userId] ? <PersonRemoveIcon /> : <PersonAddIcon />}
              onClick={() => followStatus[post.userId] ? handleUnfollow(post.userId) : handleFollow(post.userId)}
              sx={{ ml: 2 }}
            >
              {followStatus[post.userId] ? "Unfollow" : "Follow"}
            </Button>
          )}
        </Box>
        
        <Typography variant="h6" gutterBottom>
          {post.title}
        </Typography>
        
        <Typography variant="body1" paragraph>
          {post.description}
        </Typography>
        
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Grid container spacing={1}>
              {post.mediaUrls.map((url, index) => {
                const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
                return (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    {!isVideo ? (
                      <img
                        src={url}
                        alt={`${post.title} - Image ${index + 1}`}
                        style={{ 
                          width: '100%',
                          height: '200px',
                          objectFit: 'cover',
                          borderRadius: '8px'
                        }}
                        onError={(e) => {
                          console.error('Error loading image:', url);
                          e.target.src = '/placeholder-image.jpg';
                        }}
                      />
                    ) : (
                      <video
                        controls
                        style={{ 
                          width: '100%',
                          height: '200px',
                          objectFit: 'cover',
                          borderRadius: '8px'
                        }}
                      >
                        <source src={url} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}
        
        {post.ingredients && post.ingredients.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Ingredients:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {post.ingredients.map((ingredient, index) => (
                <Chip
                  key={index}
                  label={post.amounts && post.amounts[index] ? 
                    `${ingredient} - ${post.amounts[index]}` : 
                    ingredient}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {post.instructions && post.instructions.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Instructions:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {post.instructions.map((instruction, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      minWidth: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem'
                    }}
                  >
                    {index + 1}
                  </Typography>
                  <Typography variant="body2">
                    {instruction}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
      
      <PostInteraction 
        post={post} 
        onUpdate={handlePostUpdate}
      />
    </Card>
  );

  const handleNoPostsMessage = () => {
    if (activeTab === 0) {
      return 'No posts available. This may be because users have set their profiles to private. Follow users to see their posts.';
    } else {
      return 'No posts from followed users yet. Follow some users to see their posts here!';
    }
  };

  const handleNavigateToUserProfile = (userId) => {
    navigate(`/users/${userId}`);
  };

  const handleNavigateToPost = (postId) => {
    navigate(`/posts/${postId}`);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Left Sidebar - Categories */}
        {!isMobile && (
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, position: 'sticky', top: 20 }}>
              <Typography variant="h6" gutterBottom>
                Categories
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{category.icon}</span>
                        <span>{category.label}</span>
                      </Box>
                    }
                    onClick={() => handleCategoryChange(category.id)}
                    color={selectedCategory === category.id ? category.color : 'default'}
                    variant={selectedCategory === category.id ? 'filled' : 'outlined'}
                    sx={{
                      justifyContent: 'flex-start',
                      '&:hover': {
                        backgroundColor: selectedCategory === category.id ? `${category.color}.main` : 'action.hover',
                        color: selectedCategory === category.id ? 'white' : 'inherit',
                      },
                      transition: 'all 0.2s ease-in-out',
                      borderColor: selectedCategory === category.id ? `${category.color}.main` : 'inherit',
                      '& .MuiChip-label': {
                        width: '100%',
                      }
                    }}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Mobile Categories */}
        {isMobile && (
          <Box sx={{ mb: 3, overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
            <Box sx={{ display: 'inline-flex', gap: 1, pb: 1, px: 1 }}>
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{category.icon}</span>
                      <span>{category.label}</span>
                    </Box>
                  }
                  onClick={() => handleCategoryChange(category.id)}
                  color={selectedCategory === category.id ? category.color : 'default'}
                  variant={selectedCategory === category.id ? 'filled' : 'outlined'}
                  sx={{
                    '&:hover': {
                      backgroundColor: selectedCategory === category.id ? `${category.color}.main` : 'action.hover',
                      color: selectedCategory === category.id ? 'white' : 'inherit',
                    },
                    transition: 'all 0.2s ease-in-out',
                    borderColor: selectedCategory === category.id ? `${category.color}.main` : 'inherit',
                    '& .MuiChip-label': {
                      width: '100%',
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Main Content */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h4" gutterBottom>
              Cooking Community
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Connect with fellow cooking enthusiasts and share your culinary experiences
            </Typography>
            
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{ mb: 3 }}
            >
              <Tab label="For You" />
              <Tab label="Following" />
              <Tab label="Search Users" />
            </Tabs>
            
            {activeTab !== 2 && (
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={handleSearchChange}
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchQuery('');
                          if (activeTab === 0) {
                            fetchPosts();
                          } else {
                            fetchFollowingPosts();
                          }
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            )}
            
            <Divider sx={{ mb: 3 }} />
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={() => {
                    setError(null);
                    activeTab === 0 ? fetchPosts() : fetchFollowingPosts();
                  }}
                >
                  Retry
                </Button>
              </Alert>
            )}
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : activeTab === 2 ? (
              <UserSearch />
            ) : (activeTab === 0 ? filteredPosts : filteredFollowingPosts).length > 0 ? (
              <>
                {(activeTab === 0 ? filteredPosts : filteredFollowingPosts).map(renderPost)}
                {activeTab === 0 && hasMore && (
                  <Box ref={ref} sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    {loadingMore ? <CircularProgress /> : null}
                  </Box>
                )}
              </>
            ) : (
              <Typography align="center" color="text.secondary">
                {searchQuery 
                  ? 'No posts found matching your search'
                  : activeTab === 0 
                    ? 'No posts yet. Be the first to share!'
                    : 'No posts from followed users yet. Follow some users to see their posts here!'}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Right Sidebar - Trending Posts */}
        {!isMobile && (
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, position: 'sticky', top: 20 }}>
              <Typography variant="h6" gutterBottom>
                Trending Posts
              </Typography>
              {trendingPosts.map((post) => (
                <Card key={post.id} sx={{ mb: 2, cursor: 'pointer' }} onClick={() => navigate(`/posts/${post.id}`)}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="subtitle2" noWrap>
                      {post.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {post.likes} likes • {post.comments} comments
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Paper>
          </Grid>
        )}
      </Grid>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Community; 