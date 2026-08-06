import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Image as ImageIcon, 
  Type, 
  List, 
  Table as TableIcon, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Upload,
  X,
  HelpCircle,
  Settings,
  Info,
  User,
  Heading2
} from 'lucide-react';
import {
  blogService,
  Blog,
  BlogSection,
  BlogSectionType,
  BlogStatus,
  PUBLIC_BLOG_BASE_URL,
  BLOG_IMAGE_MAX_PICK_BYTES,
  type ImageUploadPhase,
} from '@/lib/blogService';
import { BlogRichTextEditor } from '@/components/blog/BlogRichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test((text || '').trim());
}

/** Safe-ish HTML for CRM preview (strip scripts/handlers + light colors). */
function sanitizeBlogHtml(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');

  out = out.replace(/\sstyle=(['"])([\s\S]*?)\1/gi, (_match, _quote, styles: string) => {
    const cleaned = styles
      .replace(/(?:^|;)\s*color\s*:[^;]*/gi, '')
      .replace(/(?:^|;)\s*background(?:-color)?\s*:[^;]*/gi, '')
      .replace(/(?:^|;)\s*-webkit-text-fill-color\s*:[^;]*/gi, '')
      .trim()
      .replace(/^;+|;+$/g, '');
    return cleaned ? ` style="${cleaned}"` : '';
  });

  return out;
}

/** Preview for paragraph body — HTML from the Panel, or legacy markdown. */
function PreviewBody({ text }: { text: string }) {
  if (!text?.trim()) {
    return <p className="text-gray-300 italic">Write your paragraph to see it here...</p>;
  }
  if (looksLikeHtml(text)) {
    return (
      <div
        className="blog-preview-html text-gray-800"
        dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(text) }}
      />
    );
  }
  return <PreviewFormattedText text={text} />;
}

/** Parse markdown heading — most specific first (### before ## before #). Requires a space after #. */
function parseMarkdownHeading(line: string): { level: 1 | 2 | 3; label: string } | null {
  const clean = (raw: string) => raw.replace(/\s*#+\s*$/g, '').trim();
  const h3 = line.match(/^###\s+(.+)$/);
  if (h3) return { level: 3, label: clean(h3[1]) };
  const h2 = line.match(/^##\s+(.+)$/);
  if (h2) return { level: 2, label: clean(h2[1]) };
  const h1 = line.match(/^#\s+(.+)$/);
  if (h1) return { level: 1, label: clean(h1[1]) };
  return null;
}

/** Simple markdown preview for CRM writers (legacy posts). */
function PreviewFormattedText({ text }: { text: string }) {
  if (!text?.trim()) {
    return <p className="text-gray-300 italic">Write your paragraph to see it here...</p>;
  }

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const joined = para.join(' ').trim();
    if (joined) {
      nodes.push(
        <p key={`p-${nodes.length}`} className="mb-3 text-gray-700 leading-relaxed">
          {inlineFormat(joined)}
        </p>
      );
    }
    para = [];
  };

  const flushList = () => {
    if (!listType || !listItems.length) return;
    const Tag = listType;
    nodes.push(
      <Tag
        key={`l-${nodes.length}`}
        className={`${listType === 'ul' ? 'list-disc' : 'list-decimal'} mb-4 ml-6 space-y-1 text-gray-700`}
      >
        {listItems.map((item, i) => (
          <li key={i}>{inlineFormat(item)}</li>
        ))}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    const heading = parseMarkdownHeading(trimmed);
    const ul = trimmed.match(/^[-*]\s+(.+)$/);
    const ol = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (heading) {
      flushPara();
      flushList();
      if (heading.level === 3) {
        nodes.push(
          <h3 key={`h-${nodes.length}`} className="mb-2 mt-4 text-xl font-semibold text-gray-900">
            {inlineFormat(heading.label)}
          </h3>
        );
      } else {
        nodes.push(
          <h2 key={`h-${nodes.length}`} className="mb-3 mt-6 text-2xl font-bold text-gray-900">
            {inlineFormat(heading.label)}
          </h2>
        );
      }
      continue;
    }

    if (ul) {
      flushPara();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ul[1]);
      continue;
    }

    if (ol) {
      flushPara();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(ol[1]);
      continue;
    }

    flushList();
    para.push(trimmed);
  }

  flushPara();
  flushList();
  return <div>{nodes}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const BlogEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const [uploading, setUploading] = useState<{ [key: string]: ImageUploadPhase | false }>({});
  const [showWriterGuide, setShowWriterGuide] = useState(true);

  const [blogData, setBlogData] = useState<Omit<Blog, 'id'>>({
    title: '',
    slug: '',
    author: 'ZICA ZIMA Admin',
    category: 'Design & VFX',
    coverImage: '',
    date: new Date(),
    readTime: '5 min read',
    sections: [],
    faqs: [],
    meta: {
      title: '',
      description: '',
      keywords: ''
    },
    status: 'draft'
  });

  useEffect(() => {
    if (isEditing && id) {
      loadBlog(id);
    }
  }, [id, isEditing]);

  const loadBlog = async (blogId: string) => {
    try {
      // In a real app, you'd fetch by ID. Our service has getAll and getBySlug.
      // For now, let's find it from getAll for simplicity in this demo.
      const all = await blogService.getAllBlogs();
      const blog = all.find(b => b.id === blogId);
      
      if (blog) {
        // Convert Firebase Timestamp to Date if needed
        const formattedBlog = {
          ...blog,
          date: (blog.date as any)?.toDate?.() || new Date(blog.date as any),
          status: blog.status || 'published',
          sections: (blog.sections || []).map((section: BlogSection) => {
            if (section.type === 'text_block' && typeof section.content === 'string') {
              return { ...section, content: { title: '', body: section.content } };
            }
            if (section.type === 'heading' && typeof section.content === 'string') {
              return { ...section, content: { level: 2, text: section.content } };
            }
            return section;
          }),
        };
        delete (formattedBlog as any).id;
        setBlogData(formattedBlog as Omit<Blog, 'id'>);
      } else {
        toast({
          title: 'Error',
          description: 'Blog post not found.',
          variant: 'destructive',
        });
        navigate('/blogs');
      }
    } catch (error) {
      console.error('Error loading blog:', error);
    } finally {
      setLoading(false);
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setBlogData(prev => ({
      ...prev,
      title,
      slug: slugify(title),
      meta: {
        ...prev.meta,
        title: prev.meta.title || title
      }
    }));
  };

  const handleFieldChange = (field: keyof Omit<Blog, 'id'>, value: any) => {
    setBlogData(prev => ({ ...prev, [field]: value }));
  };

  const handleMetaChange = (field: keyof typeof blogData.meta, value: string) => {
    setBlogData(prev => ({
      ...prev,
      meta: { ...prev.meta, [field]: value }
    }));
  };

  const uploadStatusLabel = (phase: ImageUploadPhase | false) => {
    if (phase === 'preparing') return 'Resizing…';
    if (phase === 'uploading') return 'Uploading…';
    return '';
  };

  const handleImageUpload = async (file: File, uploadKey: string, callback: (url: string) => void) => {
    try {
      setUploading(prev => ({ ...prev, [uploadKey]: 'preparing' }));
      const { url, method } = await blogService.uploadImage(file, (phase) => {
        setUploading(prev => ({ ...prev, [uploadKey]: phase }));
      });
      callback(url);
      toast({
        title: 'Image ready',
        description:
          method === 'storage'
            ? 'Image uploaded to cloud storage.'
            : 'Image saved in the post (Storage unavailable — compressed copy embedded).',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const isEmbeddedImageUrl = (url: string) => url.startsWith('data:');

  // Section Management
  const addSection = (type: BlogSectionType) => {
    let content: any = '';
    if (type === 'heading') content = { level: 2, text: '' };
    else if (type === 'text_block') content = { title: '', body: '' };
    else if (type === 'grid_list') content = [{ title: '', text: '' }];
    else if (type === 'image') content = { url: '', caption: '' };
    else if (type === 'comparison_table') {
      content = { headers: ['Feature', 'ZICA ZIMA', 'Others'], rows: [{ label: '', values: ['', ''] }] };
    }

    const newSection: BlogSection = {
      id: nanoid(),
      type,
      content,
    };
    setBlogData(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  const updateSectionFields = (id: string, patch: Record<string, unknown>) => {
    setBlogData(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === id
          ? { ...s, content: typeof s.content === 'object' && s.content !== null ? { ...s.content, ...patch } : patch }
          : s
      ),
    }));
  };

  const updateSection = (id: string, content: any) => {
    setBlogData(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, content } : s)
    }));
  };

  const removeSection = (id: string) => {
    setBlogData(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== id)
    }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...blogData.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;
    
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setBlogData(prev => ({ ...prev, sections: newSections }));
  };

  // FAQ Management
  const addFaq = () => {
    setBlogData(prev => ({
      ...prev,
      faqs: [...prev.faqs, { question: '', answer: '' }]
    }));
  };

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    const newFaqs = [...blogData.faqs];
    newFaqs[index][field] = value;
    setBlogData(prev => ({ ...prev, faqs: newFaqs }));
  };

  const removeFaq = (index: number) => {
    setBlogData(prev => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async (status: BlogStatus) => {
    if (!blogData.title || !blogData.slug) {
      toast({ title: 'Error', description: 'Title and Slug are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const payload = { ...blogData, status };
      if (isEditing && id) {
        await blogService.updateBlog(id, payload);
        toast({
          title: 'Success',
          description: status === 'published' ? 'Blog post published.' : 'Draft saved.',
        });
      } else {
        await blogService.createBlog(payload);
        toast({
          title: 'Success',
          description: status === 'published' ? 'Blog post published.' : 'Draft created.',
        });
      }
      navigate('/blogs');
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: 'Error', description: 'Failed to save blog post.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f15a24]"></div>
        <p className="text-gray-500 font-medium">Loading blog editor...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/blogs')} className="p-2 h-auto">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Blog Post' : 'Write a New Blog Post'}
            </h1>
            <p className="text-sm text-gray-500">
              Fill the basics → add content blocks → Save Draft or Publish to the website
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            onClick={() => setActiveTab(activeTab === 'editor' ? 'preview' : 'editor')}
            className="flex items-center gap-2"
          >
            {activeTab === 'editor' ? <Eye className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
            {activeTab === 'editor' ? 'Preview on website' : 'Back to writing'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="flex items-center gap-2 px-6"
            title="Save privately — not shown on the website yet"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="bg-[#f15a24] hover:bg-[#d84e1f] text-white flex items-center gap-2 px-6"
            title="Make this post live on zicazimapcmc.com"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Publishing...' : blogData.status === 'published' ? 'Update on Website' : 'Publish to Website'}
          </Button>
        </div>
      </div>

      {showWriterGuide && activeTab === 'editor' && (
        <Card className="border-orange-200 bg-orange-50/60 shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#f15a24]" />
                  Quick guide for writers
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700">
                  <li><strong>Basics</strong> — Add title, category, and a cover photo (main image at the top of the article).</li>
                  <li><strong>Build the article</strong> — Add blocks below: Heading, Paragraph, Image, etc. Order them like pages in a book.</li>
                  <li><strong>Cover photo</strong> — Use JPG under 1MB; the CRM resizes automatically before upload.</li>
                  <li>
                    <strong>Formatting</strong> — In each Paragraph block, use the toolbar
                    (heading dropdown, Bold / lists / Link icons). No need to type # or **.
                  </li>
                  <li><strong>Draft vs Publish</strong> — <em>Draft</em> keeps it private in CRM. <em>Publish</em> shows it on the public website (What&apos;s Live).</li>
                </ol>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-gray-500"
                onClick={() => setShowWriterGuide(false)}
              >
                Got it
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showWriterGuide && activeTab === 'editor' && (
        <button
          type="button"
          onClick={() => setShowWriterGuide(true)}
          className="text-sm text-[#f15a24] hover:underline flex items-center gap-1"
        >
          <HelpCircle className="w-4 h-4" /> Show writer guide
        </button>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="editor" className="space-y-8 mt-0 border-none outline-none">
          {/* Basic Info Card */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-[#f15a24]" />
                Step 1 — Post basics
              </CardTitle>
              <p className="text-sm text-gray-500 font-normal mt-1">
                This is what visitors see first: title, category, and cover photo.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Title (main headline)</label>
                  <Input 
                    placeholder="e.g. Top Career Opportunities in 3D Animation" 
                    value={blogData.title}
                    onChange={handleTitleChange}
                    className="h-11 text-lg font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Website link (auto-filled)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm whitespace-nowrap">/blogs/</span>
                    <Input 
                      placeholder="created-from-your-title" 
                      value={blogData.slug}
                      onChange={(e) => handleFieldChange('slug', e.target.value)}
                      className="bg-gray-50 h-11"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Usually leave this as-is. It becomes the page address on the website.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Author name</label>
                  <Input 
                    value={blogData.author}
                    onChange={(e) => handleFieldChange('author', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Category (topic)</label>
                  <Input 
                    value={blogData.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    placeholder="e.g. Animation, Design, Careers"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Reading time</label>
                  <Input 
                    value={blogData.readTime}
                    onChange={(e) => handleFieldChange('readTime', e.target.value)}
                    placeholder="e.g. 5 min read"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">Cover photo</label>
                    {uploading['coverImage'] && (
                      <span className="text-[10px] text-[#f15a24] animate-pulse font-bold uppercase">
                        {uploadStatusLabel(uploading['coverImage'])}
                      </span>
                    )}
                    {!uploading['coverImage'] && blogData.coverImage && (
                      <span className="text-[10px] text-green-500 font-bold">READY ✅</span>
                    )}
                  </div>
                  {blogData.coverImage && (
                    <div className="relative w-full h-36 rounded-lg overflow-hidden border border-green-200 bg-gray-50">
                      <img
                        src={blogData.coverImage}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2 h-7 text-xs"
                        onClick={() => handleFieldChange('coverImage', '')}
                        disabled={Boolean(uploading['coverImage'])}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={isEmbeddedImageUrl(blogData.coverImage) ? '' : blogData.coverImage}
                      onChange={(e) => handleFieldChange('coverImage', e.target.value)}
                      placeholder={
                        blogData.coverImage && isEmbeddedImageUrl(blogData.coverImage)
                          ? 'Cover attached — upload a new file to replace'
                          : 'Or paste an image link (https://…)'
                      }
                      className={cn(blogData.coverImage && 'border-green-200 bg-green-50/30')}
                    />
                    <label
                      className={cn(
                        'cursor-pointer bg-gray-100 hover:bg-gray-200 p-2 rounded-md transition-all flex items-center justify-center min-w-[44px]',
                        uploading['coverImage'] && 'opacity-50 cursor-not-allowed'
                      )}
                      title="Upload cover photo from your computer"
                    >
                      {uploading['coverImage'] ? (
                        <div className="w-5 h-5 border-2 border-[#f15a24] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 text-gray-600" />
                      )}
                      <input
                        type="file"
                        className="hidden"
                        disabled={Boolean(uploading['coverImage'])}
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(file, 'coverImage', (url) => handleFieldChange('coverImage', url));
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-400">
                    JPG recommended, max <strong>{Math.round(BLOG_IMAGE_MAX_PICK_BYTES / 1024)}KB</strong>. Images are
                    auto-resized before upload.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Content Sections */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Step 2 — Article content</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Add blocks in the order you want them to appear. Start with a heading, then paragraphs and images.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => addSection('heading')} className="gap-1" title="Big title inside the article">
                  <Heading2 className="w-4 h-4" /> Heading
                </Button>
                <Button size="sm" variant="outline" onClick={() => addSection('text_block')} className="gap-1" title="Normal writing / paragraphs">
                  <Type className="w-4 h-4" /> Paragraph
                </Button>
                <Button size="sm" variant="outline" onClick={() => addSection('grid_list')} className="gap-1" title="Cards or points in a grid">
                  <List className="w-4 h-4" /> Point list
                </Button>
                <Button size="sm" variant="outline" onClick={() => addSection('image')} className="gap-1" title="Photo inside the article">
                  <ImageIcon className="w-4 h-4" /> Photo
                </Button>
                <Button size="sm" variant="outline" onClick={() => addSection('comparison_table')} className="gap-1" title="Compare options in a table">
                  <TableIcon className="w-4 h-4" /> Table
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/40 px-4 py-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">How to format:</p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <span><strong>Heading 1–6</strong> — pick from the dropdown, then type</span>
                <span><strong>Bold / Italic / Underline</strong> — select text, then click the icon</span>
                <span><strong>Lists</strong> — click the bullet or numbered list icon</span>
                <span><strong>Link</strong> — select text, click the link icon, paste URL</span>
                <span className="sm:col-span-2 text-green-700">✓ You do not need # hashtags or ** for bold anymore.</span>
              </div>
            </div>

            {blogData.sections.length === 0 ? (
              <div className="py-16 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-gray-50/50 px-6 text-center">
                <Plus className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-gray-800 font-medium">No content yet</p>
                <p className="text-gray-500 text-sm mt-1 max-w-md">
                  Click <strong>Heading</strong> or <strong>Paragraph</strong> above to start writing your article.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {blogData.sections.map((section, index) => (
                  <Card key={section.id} className="group border-gray-200 hover:border-[#f15a24]/30 transition-colors">
                    <div className="p-2 border-b bg-gray-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-white border-gray-300 font-medium text-[10px]">
                          Block {index + 1}
                        </Badge>
                        <span className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center gap-1">
                          {section.type === 'heading' && <Heading2 className="w-3 h-3" />}
                          {section.type === 'text_block' && <Type className="w-3 h-3" />}
                          {section.type === 'grid_list' && <List className="w-3 h-3" />}
                          {section.type === 'image' && <ImageIcon className="w-3 h-3" />}
                          {section.type === 'comparison_table' && <TableIcon className="w-3 h-3" />}
                          {section.type === 'heading'
                            ? 'Heading'
                            : section.type === 'text_block'
                              ? 'Paragraph'
                              : section.type === 'grid_list'
                                ? 'Point list'
                                : section.type === 'image'
                                  ? 'Photo'
                                  : 'Table'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveSection(index, 'up')}>
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveSection(index, 'down')}>
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-4 bg-gray-200 mx-1" />
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => removeSection(section.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      {section.type === 'heading' ? (
                        <div className="space-y-3">
                          <div className="flex gap-3 items-center">
                            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Level</label>
                            <select
                              className="border rounded-md px-2 py-1 text-sm"
                              value={section.content?.level || 2}
                              onChange={(e) => updateSectionFields(section.id, { level: Number(e.target.value) })}
                            >
                              <option value={2}>Large heading (H2)</option>
                              <option value={3}>Smaller subheading (H3)</option>
                            </select>
                          </div>
                          <Input
                            placeholder="Heading text..."
                            value={section.content?.text || ''}
                            onChange={(e) => updateSectionFields(section.id, { text: e.target.value })}
                            className="text-xl font-bold border-none focus-visible:ring-0 px-0"
                          />
                        </div>
                      ) : section.type === 'text_block' ? (
                        <div className="space-y-3">
                          <Input
                            placeholder="Optional small title above this paragraph (e.g. Why choose animation?)"
                            value={typeof section.content === 'object' ? (section.content?.title || '') : ''}
                            onChange={(e) => updateSectionFields(section.id, { title: e.target.value })}
                            className="font-semibold"
                          />
                          <BlogRichTextEditor
                            key={section.id}
                            value={
                              typeof section.content === 'string'
                                ? section.content
                                : (section.content?.body || '')
                            }
                            onChange={(html) => {
                              if (typeof section.content === 'string') {
                                updateSection(section.id, { title: '', body: html });
                              } else {
                                updateSectionFields(section.id, { body: html });
                              }
                            }}
                            placeholder="Write your story here. Use the toolbar for headings, Bold, lists, and links."
                          />
                          <p className="text-xs text-gray-400">
                            Use the toolbar — heading dropdown and icons — instead of typing # or **.
                          </p>
                        </div>
                      ) : section.type === 'image' ? (
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-gray-500">Image URL</label>
                                {uploading[section.id] && (
                                  <span className="text-[10px] text-[#f15a24] animate-pulse font-bold uppercase">
                                    {uploadStatusLabel(uploading[section.id])}
                                  </span>
                                )}
                                {!uploading[section.id] && section.content.url && (
                                  <span className="text-[10px] text-green-500 font-bold">IMAGE UPLOADED ✅</span>
                                )}
                              </div>
                              {section.content.url && (
                                <div className="relative w-full h-24 rounded-md overflow-hidden border border-green-200 bg-gray-50 mb-2">
                                  <img
                                    src={section.content.url}
                                    alt="Section preview"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Input
                                  value={
                                    section.content.url && isEmbeddedImageUrl(section.content.url)
                                      ? ''
                                      : section.content.url
                                  }
                                  onChange={(e) =>
                                    updateSection(section.id, { ...section.content, url: e.target.value })
                                  }
                                  placeholder={
                                    section.content.url && isEmbeddedImageUrl(section.content.url)
                                      ? 'Image attached — upload to replace'
                                      : 'https://… or upload'
                                  }
                                  className={cn(section.content.url && 'border-green-200 bg-green-50/30')}
                                />
                                <label
                                  className={cn(
                                    'cursor-pointer bg-gray-100 hover:bg-gray-200 p-2 rounded-md flex items-center justify-center min-w-[44px]',
                                    uploading[section.id] && 'opacity-50 cursor-not-allowed'
                                  )}
                                >
                                  {uploading[section.id] ? (
                                    <div className="w-5 h-5 border-2 border-[#f15a24] border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Upload className="w-5 h-5 text-gray-600" />
                                  )}
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    disabled={Boolean(uploading[section.id])}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleImageUpload(file, section.id, (url) =>
                                          updateSection(section.id, { ...section.content, url })
                                        );
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                            <div className="flex-1 space-y-2">
                              <label className="text-xs font-semibold text-gray-500">Caption (Optional)</label>
                              <Input 
                                value={section.content.caption}
                                onChange={(e) => updateSection(section.id, { ...section.content, caption: e.target.value })}
                                placeholder="Image caption..."
                              />
                            </div>
                          </div>
                          {section.content.url && (
                            <div className="relative rounded-lg overflow-hidden h-40 w-fit group/preview">
                              <img src={section.content.url} className="h-full object-contain bg-gray-50 rounded-lg border border-green-100 shadow-sm" />
                              <button 
                                className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover/preview:opacity-100 transition-opacity"
                                onClick={() => updateSection(section.id, { ...section.content, url: '' })}
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-green-500 text-white text-[8px] font-bold rounded uppercase tracking-wider">
                                Current Image
                              </div>
                            </div>
                          )}
                        </div>
                      ) : section.type === 'grid_list' ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {section.content.map((item: any, idx: number) => (
                              <div key={idx} className="p-3 border rounded-lg bg-white space-y-2 relative group/item">
                                <Input 
                                  placeholder="Item Title" 
                                  value={item.title}
                                  onChange={(e) => {
                                    const newList = [...section.content];
                                    newList[idx].title = e.target.value;
                                    updateSection(section.id, newList);
                                  }}
                                  className="font-bold text-sm h-8"
                                />
                                <Textarea 
                                  placeholder="Item Description" 
                                  value={item.text}
                                  onChange={(e) => {
                                    const newList = [...section.content];
                                    newList[idx].text = e.target.value;
                                    updateSection(section.id, newList);
                                  }}
                                  className="text-xs min-h-[60px]"
                                />
                                <button 
                                  className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-500 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                                  onClick={() => {
                                    const newList = section.content.filter((_: any, i: number) => i !== idx);
                                    updateSection(section.id, newList);
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <Button size="sm" variant="ghost" className="w-full border-2 border-dashed border-gray-200" onClick={() => updateSection(section.id, [...section.content, { title: '', text: '' }])}>
                            <Plus className="w-3 h-3 mr-2" /> Add Grid Item
                          </Button>
                        </div>
                      ) : section.type === 'comparison_table' ? (
                        <div className="space-y-4 overflow-x-auto">
                          <table className="w-full border-collapse border rounded-lg overflow-hidden">
                            <thead className="bg-gray-100">
                              <tr>
                                {section.content.headers.map((h: string, idx: number) => (
                                  <th key={idx} className="p-2 border">
                                    <Input 
                                      value={h}
                                      onChange={(e) => {
                                        const newHeaders = [...section.content.headers];
                                        newHeaders[idx] = e.target.value;
                                        updateSection(section.id, { ...section.content, headers: newHeaders });
                                      }}
                                      className="h-8 font-bold text-center border-none bg-transparent"
                                    />
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.content.rows.map((row: any, rIdx: number) => (
                                <tr key={rIdx}>
                                  <td className="p-2 border">
                                    <Input 
                                      value={row.label}
                                      onChange={(e) => {
                                        const newRows = [...section.content.rows];
                                        newRows[rIdx].label = e.target.value;
                                        updateSection(section.id, { ...section.content, rows: newRows });
                                      }}
                                      className="h-8 border-none"
                                      placeholder="Feature label"
                                    />
                                  </td>
                                  {row.values.map((val: string, vIdx: number) => (
                                    <td key={vIdx} className="p-2 border">
                                      <Input 
                                        value={val}
                                        onChange={(e) => {
                                          const newRows = [...section.content.rows];
                                          newRows[rIdx].values[vIdx] = e.target.value;
                                          updateSection(section.id, { ...section.content, rows: newRows });
                                        }}
                                        className="h-8 border-none text-center"
                                      />
                                    </td>
                                  ))}
                                  <td className="p-2 border text-center">
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => {
                                      const newRows = section.content.rows.filter((_: any, i: number) => i !== rIdx);
                                      updateSection(section.id, { ...section.content, rows: newRows });
                                    }}>
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <Button size="sm" variant="ghost" className="w-full border-2 border-dashed border-gray-200" onClick={() => updateSection(section.id, { ...section.content, rows: [...section.content.rows, { label: '', values: Array(section.content.headers.length - 1).fill('') }] })}>
                            <Plus className="w-3 h-3 mr-2" /> Add Row
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-lg text-center py-8">
                          <p className="text-sm text-gray-400 italic">Editor for {section.type} coming soon.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* FAQs and Meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-gray-200">
              <CardHeader className="bg-gray-50/50 border-b flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#f15a24]" /> Step 3 — FAQs (optional)
                  </CardTitle>
                  <p className="text-xs text-gray-500 font-normal mt-1">Common questions at the bottom of the article</p>
                </div>
                <Button size="sm" variant="ghost" onClick={addFaq} className="h-8 text-[#f15a24]">
                  <Plus className="w-4 h-4 mr-1" /> Add question
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {blogData.faqs.map((faq, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-3 bg-white relative group">
                    <Input 
                      placeholder="e.g. Is animation a good career after 12th?" 
                      value={faq.question}
                      onChange={(e) => updateFaq(idx, 'question', e.target.value)}
                      className="font-semibold text-sm border-none bg-gray-50"
                    />
                    <Textarea 
                      placeholder="Write a short, clear answer..." 
                      value={faq.answer}
                      onChange={(e) => updateFaq(idx, 'answer', e.target.value)}
                      className="text-sm border-none bg-gray-50 min-h-[60px]"
                    />
                    <button 
                      className="absolute -top-2 -right-2 p-1.5 bg-white border shadow-sm text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFaq(idx)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {blogData.faqs.length === 0 && (
                  <p className="text-center py-4 text-gray-400 text-sm">No FAQs yet — click &quot;Add question&quot; if you want this section.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="bg-gray-50/50 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#f15a24]" /> Step 4 — Google / search preview (optional)
                </CardTitle>
                <p className="text-xs text-gray-500 font-normal mt-1">
                  Helps Google show your post nicely. If empty, we use your blog title.
                </p>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">Search title</label>
                  <Input 
                    value={blogData.meta.title} 
                    onChange={(e) => handleMetaChange('title', e.target.value)}
                    placeholder="Usually same as your blog title"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">Short summary (1–2 lines)</label>
                  <Textarea 
                    value={blogData.meta.description} 
                    onChange={(e) => handleMetaChange('description', e.target.value)}
                    placeholder="What is this article about? Shown on Google and blog cards."
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">Keywords (optional)</label>
                  <Input 
                    value={blogData.meta.keywords} 
                    onChange={(e) => handleMetaChange('keywords', e.target.value)}
                    placeholder="e.g. 3D animation, careers after 12th, VFX"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0 outline-none border-none">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            <div className="bg-gray-900 px-4 py-2 flex items-center justify-between text-white text-xs">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="font-mono">{PUBLIC_BLOG_BASE_URL}/{blogData.slug || '...' }</span>
              <div className="w-10" />
            </div>
            
            <div className="max-w-3xl mx-auto py-16 px-6 sm:px-12 space-y-10">
              {/* Preview Header */}
              <div className="space-y-6 text-center">
                <Badge className="bg-[#f15a24] text-white border-none uppercase tracking-widest text-[10px]">
                  {blogData.category}
                </Badge>
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-[1.1]">
                  {blogData.title || 'Post Title Goes Here'}
                </h1>
                <div className="flex items-center justify-center gap-6 text-gray-500 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    {blogData.author}
                  </span>
                  <span>•</span>
                  <span>{blogData.readTime}</span>
                </div>
              </div>

              {/* Cover Image */}
              {blogData.coverImage && (
                <div className="aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-gray-100">
                  <img src={blogData.coverImage} className="w-full h-full object-cover" alt="Preview" />
                </div>
              )}

              {/* Content Preview */}
              <div className="prose prose-lg max-w-none space-y-8 text-gray-700 leading-relaxed">
                {blogData.sections.length === 0 ? (
                  <p className="text-gray-300 italic text-center py-12">Main content area preview...</p>
                ) : (
                  blogData.sections.map((section) => (
                    <div key={section.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {section.type === 'heading' ? (
                        section.content?.level === 3 ? (
                          <h3 className="text-xl font-semibold text-gray-900">{section.content?.text || 'Subheading'}</h3>
                        ) : (
                          <h2 className="text-2xl font-bold text-gray-900">{section.content?.text || 'Heading'}</h2>
                        )
                      ) : section.type === 'text_block' ? (
                        <div className="space-y-2">
                          {(typeof section.content === 'object' ? section.content?.title : '') ? (
                            <h2 className="text-xl font-bold text-gray-900">
                              {typeof section.content === 'object' ? section.content.title : ''}
                            </h2>
                          ) : null}
                          <PreviewBody
                            text={
                              typeof section.content === 'string'
                                ? section.content
                                : (section.content?.body || '')
                            }
                          />
                        </div>
                      ) : section.type === 'image' ? (
                        <figure className="space-y-3">
                          <img src={section.content.url} className="rounded-xl w-full" />
                          {section.content.caption && (
                            <figcaption className="text-center text-sm text-gray-500 italic">
                              {section.content.caption}
                            </figcaption>
                          )}
                        </figure>
                      ) : section.type === 'grid_list' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose">
                          {section.content.map((item: any, idx: number) => (
                            <div key={idx} className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl space-y-3">
                              <h4 className="text-xl font-bold text-gray-900">{item.title}</h4>
                              <p className="text-gray-600 text-sm leading-relaxed">{item.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : section.type === 'comparison_table' ? (
                        <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm not-prose">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-900 text-white">
                                {section.content.headers.map((h: string, i: number) => (
                                  <th key={i} className="p-4 text-left font-bold border-r border-gray-800 last:border-0">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.content.rows.map((row: any, i: number) => (
                                <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                  <td className="p-4 font-bold text-gray-900 bg-gray-50/50">{row.label}</td>
                                  {row.values.map((v: string, j: number) => (
                                    <td key={j} className="p-4 text-gray-600 font-medium">{v}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-center">
                          {section.type} Preview
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* FAQ Preview */}
              {blogData.faqs.length > 0 && (
                <div className="pt-16 border-t border-gray-100 space-y-8">
                  <h2 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
                  <div className="space-y-4">
                    {blogData.faqs.map((faq, i) => (
                      <div key={i} className="p-6 bg-gray-50 rounded-2xl space-y-2">
                        <h4 className="text-lg font-bold text-gray-900">Q: {faq.question}</h4>
                        <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BlogEditor;
