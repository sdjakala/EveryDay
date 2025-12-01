import React, {useState} from 'react';
import Icon from '../../components/Icon';

type Task = {id: string; title: string; completed?: boolean};

const initial: Task[] = [
  {id: 't1', title: 'Review project plan', completed: false},
  {id: 't2', title: 'Prepare meeting notes', completed: true}
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function TasksModule() {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  function addTask(e?: React.FormEvent) {
    e?.preventDefault();
    const title = text.trim();
    if (!title) return;
    const t = {id: uid(), title, completed: false};
    setTasks(s => [t, ...s]);
    setText('');
  }

  function toggle(id: string) {
    setTasks(s => s.map(t => (t.id === id ? {...t, completed: !t.completed} : t)));
  }

  function remove(id: string) {
    setTasks(s => s.filter(t => t.id !== id));
  }

  function startEdit(t: Task) {
    setEditingId(t.id);
    setEditText(t.title);
  }

  function saveEdit(id: string) {
    const v = editText.trim();
    if (!v) return;
    setTasks(s => s.map(t => (t.id === id ? {...t, title: v} : t)));
    setEditingId(null);
    setEditText('');
  }

  return (
    <div>
      <div className="tasks-toolbar">
        <form className="create-task-form" onSubmit={addTask}>
          <input className="task-input" placeholder="Create a task..." value={text} onChange={e => setText(e.target.value)} />
          <button type="submit" className="task-add-btn">Create</button>
        </form>
      </div>

      <div className="tasks-list">
        {tasks.map(t => (
          <div className="task-item" key={t.id}>
            <div className="task-checkbox" onClick={() => toggle(t.id)}>
              {t.completed ? <Icon name="check" size={14} /> : null}
            </div>

            {editingId === t.id ? (
              <input className="task-edit-input" value={editText} onChange={e => setEditText(e.target.value)} onBlur={() => saveEdit(t.id)} onKeyDown={e => e.key === 'Enter' && saveEdit(t.id)} />
            ) : (
              <div className={`task-title ${t.completed ? 'completed' : ''}`}>{t.title}</div>
            )}

            <div className="task-actions">
              <button className="task-action-btn" onClick={() => (editingId === t.id ? saveEdit(t.id) : startEdit(t))}><Icon name="edit" /> <span style={{marginLeft:6}}>{editingId === t.id ? 'Save' : 'Edit'}</span></button>
              <button className="task-action-btn" onClick={() => remove(t.id)}><Icon name="trash" /> <span style={{marginLeft:6}}>Delete</span></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
