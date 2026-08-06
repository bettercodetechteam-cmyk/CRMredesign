import { useMemo } from 'react';
import { format } from 'date-fns';
import type { TaskComment } from '@shared/taskTypes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface TaskCommentsProps {
  comments: TaskComment[];
  currentUserId?: string;
  onAdd: (text: string, parentId?: string) => Promise<void>;
  onEdit?: (commentId: string, text: string) => Promise<void>;
}

function CommentItem({
  comment,
  replies,
  currentUserId,
  onReply,
  onEdit,
  depth = 0,
}: {
  comment: TaskComment;
  replies: TaskComment[];
  currentUserId?: string;
  onReply: (parentId: string, text: string) => Promise<void>;
  onEdit?: (commentId: string, text: string) => Promise<void>;
  depth?: number;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [replyText, setReplyText] = useState('');

  const isOwn = currentUserId === comment.userId;

  return (
    <div className={depth > 0 ? 'ml-2 sm:ml-6 mt-3 border-l-2 pl-2 sm:pl-4' : 'mt-4'}>
      <div className="bg-muted/40 rounded-lg p-3">
        <div className="flex flex-col xs:flex-row xs:justify-between xs:items-start gap-1">
          <div className="min-w-0">
            <span className="font-medium text-sm">{comment.userName}</span>
            <span className="text-xs text-muted-foreground xs:ml-2 block xs:inline mt-0.5 xs:mt-0">
              {format(new Date(comment.createdAt), 'dd MMM yyyy HH:mm')}
            </span>
          </div>
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => { await onEdit?.(comment.id, text); setEditing(false); }}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setText(comment.text); setEditing(false); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-1 whitespace-pre-wrap">{comment.text}</p>
        )}
        <div className="flex gap-2 mt-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setReplying(!replying)}>
            Reply
          </Button>
          {isOwn && onEdit && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
        {replying && (
          <div className="mt-2 space-y-2">
            <Textarea
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
            />
            <Button
              size="sm"
              disabled={!replyText.trim()}
              onClick={async () => {
                await onReply(comment.id, replyText);
                setReplyText('');
                setReplying(false);
              }}
            >
              Post Reply
            </Button>
          </div>
        )}
      </div>
      {replies.map((r) => (
        <CommentItem
          key={r.id}
          comment={r}
          replies={[]}
          currentUserId={currentUserId}
          onReply={onReply}
          onEdit={onEdit}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function TaskComments({ comments, currentUserId, onAdd, onEdit }: TaskCommentsProps) {
  const [newComment, setNewComment] = useState('');

  const { roots, repliesMap } = useMemo(() => {
    const map = new Map<string, TaskComment[]>();
    const rootComments: TaskComment[] = [];
    for (const c of comments) {
      if (c.parentCommentId) {
        const list = map.get(c.parentCommentId) || [];
        list.push(c);
        map.set(c.parentCommentId, list);
      } else {
        rootComments.push(c);
      }
    }
    return { roots: rootComments, repliesMap: map };
  }, [comments]);

  const handleReply = async (parentId: string, text: string) => {
    await onAdd(text, parentId);
  };

  return (
    <div>
      <div className="space-y-2 mb-4">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />
        <Button
          disabled={!newComment.trim()}
          className="w-full sm:w-auto"
          onClick={async () => {
            await onAdd(newComment);
            setNewComment('');
          }}
        >
          Post Comment
        </Button>
      </div>
      {roots.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          replies={repliesMap.get(c.id) || []}
          currentUserId={currentUserId}
          onReply={handleReply}
          onEdit={onEdit}
        />
      ))}
      {roots.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
      )}
    </div>
  );
}
