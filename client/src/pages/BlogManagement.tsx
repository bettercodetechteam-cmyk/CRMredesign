import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ExternalLink, 
  Calendar, 
  Clock, 
  User,
  Layout as LayoutIcon,
  Filter,
  MoreVertical
} from 'lucide-react';
import { blogService, Blog, BlogStatus, PUBLIC_BLOG_BASE_URL } from '@/lib/blogService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const BlogManagement: React.FC = () => {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    try {
      setLoading(true);
      const data = await blogService.getAllBlogs();
      setBlogs(data);
    } catch (error) {
      console.error('Error loading blogs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load blogs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this blog post?')) return;

    try {
      await blogService.deleteBlog(id);
      setBlogs(blogs.filter(b => b.id !== id));
      toast({
        title: 'Success',
        description: 'Blog post deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting blog:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete blog post.',
        variant: 'destructive',
      });
    }
  };

  const handleTogglePublish = async (blog: Blog) => {
    if (!blog.id) return;

    const nextStatus: BlogStatus = blog.status === 'published' ? 'draft' : 'published';
    const actionLabel = nextStatus === 'published' ? 'publish' : 'unpublish';

    if (!window.confirm(`Are you sure you want to ${actionLabel} "${blog.title}"?`)) return;

    try {
      await blogService.updateBlog(blog.id, { status: nextStatus });
      setBlogs(blogs.map(b => (b.id === blog.id ? { ...b, status: nextStatus } : b)));
      toast({
        title: 'Success',
        description: nextStatus === 'published' ? 'Blog post published.' : 'Blog post moved to drafts.',
      });
    } catch (error) {
      console.error('Error updating blog status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update blog status.',
        variant: 'destructive',
      });
    }
  };

  const getBlogStatus = (blog: Blog): BlogStatus =>
    blog.status === 'draft' ? 'draft' : 'published';

  const publishedCount = blogs.filter(b => getBlogStatus(b) === 'published').length;
  const draftCount = blogs.filter(b => getBlogStatus(b) === 'draft').length;

  const filteredBlogs = blogs.filter(blog =>
    blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    blog.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    blog.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutIcon className="w-8 h-8 text-[#f15a24]" />
            Blog Management
          </h1>
          <p className="text-gray-500 mt-1">
            Write posts for the ZICA ZIMA website. <strong>Draft</strong> = only in CRM.{' '}
            <strong>Published</strong> = live on What&apos;s Live.
          </p>
        </div>
        <Button 
          onClick={() => navigate('/blogs/new')}
          className="bg-[#f15a24] hover:bg-[#d84e1f] text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Write New Blog
        </Button>
      </div>

      <Card className="border-blue-100 bg-blue-50/50 shadow-none">
        <CardContent className="p-4 text-sm text-gray-700 space-y-1">
          <p className="font-semibold text-gray-900">How it works</p>
          <ul className="list-disc list-inside space-y-0.5 text-gray-600">
            <li>Click <strong>Write New Blog</strong> and fill title, cover photo, then content blocks.</li>
            <li>Use <strong>Save as Draft</strong> while writing. Use <strong>Publish to Website</strong> when ready.</li>
            <li>Published posts appear on <span className="text-[#f15a24]">zicazimapcmc.com</span> (What&apos;s Live).</li>
          </ul>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-l-4 border-[#f15a24]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Posts</p>
              <h3 className="text-2xl font-bold text-gray-900">{blogs.length}</h3>
            </div>
            <LayoutIcon className="w-10 h-10 text-gray-200" />
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-green-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Published</p>
              <h3 className="text-2xl font-bold text-gray-900">{publishedCount}</h3>
            </div>
            <ExternalLink className="w-10 h-10 text-gray-200" />
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-amber-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Drafts</p>
              <h3 className="text-2xl font-bold text-gray-900">{draftCount}</h3>
            </div>
            <Filter className="w-10 h-10 text-gray-200" />
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input 
            placeholder="Search blogs by title, author, or category..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Blog List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f15a24]"></div>
          <p className="text-gray-500 font-medium">Fetching blog posts...</p>
        </div>
      ) : filteredBlogs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlogs.map((blog) => (
            <Card key={blog.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-none ring-1 ring-gray-200">
              <div className="relative h-48 bg-gray-100">
                {blog.coverImage ? (
                  <img 
                    src={blog.coverImage} 
                    alt={blog.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                    <LayoutIcon className="w-12 h-12" />
                  </div>
                )}
                <Badge className="absolute top-3 left-3 bg-white/90 text-gray-900 hover:bg-white border-none shadow-sm capitalize">
                  {blog.category}
                </Badge>
                <Badge
                  className={`absolute top-3 right-3 border-none shadow-sm capitalize ${
                    getBlogStatus(blog) === 'published'
                      ? 'bg-green-600 text-white hover:bg-green-600'
                      : 'bg-amber-500 text-white hover:bg-amber-500'
                  }`}
                >
                  {getBlogStatus(blog)}
                </Badge>
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-[#f15a24] transition-colors">
                    {blog.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {blog.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {blog.date
                        ? format(
                            (blog.date as any)?.toDate?.()
                              ? (blog.date as any).toDate()
                              : blog.date instanceof Date
                                ? blog.date
                                : new Date(blog.date as any),
                            'MMM dd, yyyy'
                          )
                        : 'No Date'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {blog.readTime}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-600 hover:text-[#f15a24] hover:bg-orange-50 px-2"
                      onClick={() => navigate(`/blogs/edit/${blog.id}`)}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-[#f15a24] hover:bg-orange-50 px-2"
                      onClick={() => handleTogglePublish(blog)}
                    >
                      {getBlogStatus(blog) === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                      onClick={() => handleDelete(blog.id!)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                  {getBlogStatus(blog) === 'published' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-gray-900"
                      title="View Public Post"
                      onClick={() => window.open(`${PUBLIC_BLOG_BASE_URL}/${blog.slug}`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border-2 border-dashed border-gray-200">
          <div className="bg-gray-50 p-4 rounded-full mb-4">
            <LayoutIcon className="w-12 h-12 text-gray-300" />
          </div>
                          <h3 className="text-xl font-bold text-gray-900">No blog posts yet</h3>
          <p className="text-gray-500 mb-6 text-center max-w-sm">
            Start by writing your first article. You can save it as a draft, then publish when it looks good.
          </p>
          <Button 
            onClick={() => navigate('/blogs/new')}
            className="bg-[#f15a24] hover:bg-[#d84e1f] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Write Your First Blog
          </Button>
        </div>
      )}
    </div>
  );
};

export default BlogManagement;
