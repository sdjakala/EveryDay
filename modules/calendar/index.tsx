import React, {useMemo, useState} from 'react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';

type EventItem = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string; // ISO
  location?: string;
};

const sampleEvents: EventItem[] = [
  {id: 'e1', title: 'Team Standup', start: new Date().toISOString().replace(/T.*$/, 'T09:00:00'), end: undefined},
  {id: 'e2', title: 'Project Sync', start: new Date().toISOString().replace(/T.*$/, 'T11:00:00'), end: undefined},
  {id: 'e3', title: 'Lunch w/ Mentors', start: new Date().toISOString().replace(/T.*$/, 'T12:30:00'), end: undefined}
];

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

export default function CalendarModule() {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [cursor, setCursor] = useState(() => new Date());
 

  // local events state (persist while page loaded). Initialize sample events anchored to today.
  const initialEvents = (baseDate: Date) =>
    sampleEvents.map((ev, i) => {
      const base = new Date(baseDate);
      base.setHours(new Date(ev.start).getHours(), new Date(ev.start).getMinutes(), 0, 0);
      return {...ev, start: base.toISOString(), id: ev.id + '-' + i};
    });

  const [events, setEvents] = useState<EventItem[]>(() => initialEvents(new Date()));

  // Modal & editor state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0,10));
  const [formTime, setFormTime] = useState(() => new Date().toTimeString().slice(0,5));
  const [formLocation, setFormLocation] = useState('');

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);

  function openAdd() {
    setEditingEvent(null);
    setFormTitle('');
    setFormLocation('');
    setFormDate(cursor.toISOString().slice(0,10));
    setFormTime('09:00');
    setModalOpen(true);
  }

  function openEdit(ev: EventItem) {
    const d = new Date(ev.start);
    setEditingEvent(ev);
    setFormTitle(ev.title || '');
    setFormLocation(ev.location || '');
    setFormDate(d.toISOString().slice(0,10));
    setFormTime(d.toTimeString().slice(0,5));
    setModalOpen(true);
  }

  function saveEvent() {
    const iso = new Date(formDate + 'T' + formTime + ':00').toISOString();
    if (editingEvent) {
      setEvents(s => s.map(e => (e.id === editingEvent.id ? {...e, title: formTitle, start: iso, location: formLocation} : e)));
    } else {
      const id = 'ev-' + Math.random().toString(36).slice(2,9);
      setEvents(s => [{id, title: formTitle, start: iso, location: formLocation}, ...s]);
    }
    setModalOpen(false);
  }

  function deleteEvent(id: string) {
    setEvents(s => s.filter(e => e.id !== id));
    setModalOpen(false);
  }

  function gotoToday() {
    setCursor(new Date());
  }

  function prev() {
    setCursor(c => (view === 'day' ? addDays(c, -1) : addDays(c, -7)));
  }

  function next() {
    setCursor(c => (view === 'day' ? addDays(c, 1) : addDays(c, 7)));
  }

  return (
    <div className="module-card">
      <div className="calendar-toolbar">
        <div className="left">
          <button className="cal-btn" onClick={prev}><Icon name="chev-left" /></button>
          <button className="cal-btn" onClick={gotoToday}><Icon name="calendar" /> <span style={{marginLeft:8}}>Today</span></button>
          <button className="cal-btn" onClick={next}><Icon name="chev-right" /></button>
        </div>

        <div className="center">
          <strong>{view === 'day' ? fmtDate(cursor) : `${fmtDate(weekStart)} — ${fmtDate(addDays(weekStart,6))}`}</strong>
        </div>

        <div className="right">
            <button className="cal-btn" onClick={openAdd}><Icon name="plus" /> Add Event</button>
          <button className={`cal-btn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>Day</button>
          <button className={`cal-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
        </div>
      </div>

      {view === 'day' ? (
        <div className="calendar-day">
          {events.filter(ev => isSameDay(new Date(ev.start), cursor)).length === 0 ? (
            <div className="empty">No events for this day.</div>
          ) : (
            <ul className="day-list">
              {events.filter(ev => isSameDay(new Date(ev.start), cursor)).map(ev => (
                <li key={ev.id} className="calendar-event" onClick={() => openEdit(ev)}>
                  <div className="time">{fmtTime(ev.start)}</div>
                  <div className="ev-body">
                    <div className="ev-title">{ev.title}</div>
                    {ev.location && <div className="ev-loc">{ev.location}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="calendar-week">
          <div className="week-grid">
            {Array.from({length:7}).map((_, i) => {
              const day = addDays(weekStart, i);
              const dayEvents = events.filter(ev => isSameDay(new Date(ev.start), day));
              return (
                <div className="weekday-col" key={i}>
                  <div className={`weekday-header ${isSameDay(day, new Date()) ? 'today' : ''}`}>
                    <div className="wk-name">{day.toLocaleDateString(undefined, {weekday: 'short'})}</div>
                    <div className="wk-date">{day.getDate()}</div>
                  </div>

                  <div className="weekday-body">
                    {dayEvents.length === 0 ? (
                      <div className="no-ev">—</div>
                    ) : (
                      dayEvents.map(ev => (
                        <div className="week-event" key={ev.id} onClick={() => openEdit(ev)}>
                          <div className="we-time">{fmtTime(ev.start)}</div>
                          <div className="we-title">{ev.title}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3>{editingEvent ? 'Edit Event' : 'Create Event'}</h3>
        <div>
          <label>Title</label>
          <input value={formTitle} onChange={e => setFormTitle(e.target.value)} type="text" />
        </div>
        <div className="form-row">
          <div style={{flex:1}}>
            <label>Date</label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
          </div>
          <div style={{width:120}}>
            <label>Time</label>
            <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label>Location</label>
          <input type="text" value={formLocation} onChange={e => setFormLocation(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          {editingEvent && <button className="btn secondary" onClick={() => deleteEvent(editingEvent.id)}>Delete</button>}
          <button className="btn primary" onClick={saveEvent}>{editingEvent ? 'Save' : 'Create'}</button>
        </div>
      </Modal>
    </div>
  );
}
