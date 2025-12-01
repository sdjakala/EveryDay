import React, {useEffect, useState} from 'react';
import Icon from '../../components/Icon';

type NewsItem = {
  id: string;
  author: string;
  avatar?: string;
  time: string;
  title: string;
  excerpt: string;
  likes?: number;
  comments?: number;
};

const sampleNews: NewsItem[] = [
  {
    id: '1',
    author: 'Campus News',
    time: '2h',
    title: 'Weekly Events Roundup',
    excerpt: "Here's what's happening this week — meetings, socials, and a community hack night.",
    likes: 12,
    comments: 3
  },
  {
    id: '2',
    author: 'Project Team',
    time: '1d',
    title: 'New Task Board Released',
    excerpt: 'We launched a new task board to help teams stay in sync — give it a try and share feedback.',
    likes: 27,
    comments: 8
  }
];

export default function NewsModule() {
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    fetch('/api/newsFeed')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.items) && d.items.length) {
          // try to map external items to our shape if possible
          const mapped = d.items.map((it: any, i: number) => ({
            id: it.id || String(i),
            author: it.author || it.source || 'News',
            time: it.time || it.published || 'now',
            title: it.title || it.headline || it.text?.slice(0, 40) || 'Update',
            excerpt: it.excerpt || it.text || '',
            likes: it.likes || 0,
            comments: it.comments || 0
          }));
          setItems(mapped);
        } else {
          setItems(sampleNews);
        }
      })
      .catch(() => setItems(sampleNews));
  }, []);

  return (
    <div className="news-list">
      {items.map(item => (
        <article key={item.id} className="news-card">
          <div className="avatar">{item.author.split(' ').map(s => s[0]).slice(0,2).join('')}</div>
          <div className="content">
            <h4 className="title">{item.title}</h4>
            <p className="excerpt">{item.excerpt}</p>
            <div className="meta">
              <div>{item.author}</div>
              <div className="dot" />
              <div>{item.time}</div>
            </div>
          </div>

          <div className="actions">
            <button className="action-btn like"><Icon name="heart" /> <span style={{marginLeft:6}}>{item.likes ?? 0}</span></button>
            <button className="action-btn"><Icon name="comment" /> <span style={{marginLeft:6}}>{item.comments ?? 0}</span></button>
          </div>
        </article>
      ))}
    </div>
  );
}
