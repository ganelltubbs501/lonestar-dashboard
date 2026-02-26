'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/hooks';
import { WorkItemTypeLabel, formatDate } from '@/lib/utils';
import { ArrowLeft, Save, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { WorkItemType, WorkItemPriority } from '@prisma/client';

interface TriggerOption {
  key: string;
  type: WorkItemType;
  label: string;
  desc: string;
  icon: string;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    key: 'BOOK_CAMPAIGN',
    type: WorkItemType.BOOK_CAMPAIGN,
    label: 'New Book Campaign',
    desc: 'Launch a full marketing cycle for a new title.',
    icon: '📚',
  },
  {
    key: 'SOCIAL_ASSET_REQUEST',
    type: WorkItemType.SOCIAL_ASSET_REQUEST,
    label: 'Social Asset Request',
    desc: 'Need graphics or copy for social media.',
    icon: '🎨',
  },
  {
    key: 'SPONSORED_EDITORIAL_REVIEW',
    type: WorkItemType.SPONSORED_EDITORIAL_REVIEW,
    label: 'Editorial Review',
    desc: 'Process a paid review request.',
    icon: '📝',
  },
  {
    key: 'TX_BOOK_PREVIEW_LEAD',
    type: WorkItemType.TX_BOOK_PREVIEW_LEAD,
    label: 'TX Book Lead',
    desc: 'Texas Book Preview author lead.',
    icon: '🌟',
  },
  {
    key: 'WEBSITE_EVENT',
    type: WorkItemType.WEBSITE_EVENT,
    label: 'Website Event',
    desc: 'Add event to the calendar.',
    icon: '📅',
  },
  {
    key: 'WEEKEND_EVENTS_POST',
    type: WorkItemType.WEBSITE_EVENT,
    label: 'Weekend Events Post',
    desc: 'Compile and publish the weekly weekend events social post.',
    icon: '🗓️',
  },
  {
    key: 'MAGAZINE_ITEM',
    type: WorkItemType.GENERAL,
    label: 'Magazine Content Item',
    desc: 'Cover story, editor letter, feature, ad, or other magazine deliverable.',
    icon: '📖',
  },
  {
    key: 'ACCESS_REQUEST',
    type: WorkItemType.ACCESS_REQUEST,
    label: 'Access Request',
    desc: 'System login or permissions.',
    icon: '🔑',
  },
];

// Book Campaign milestones with offset days from pub date
const BOOK_CAMPAIGN_MILESTONES = [
  { title: 'Receive book materials from author/publisher', offsetDays: -45 },
  { title: 'Create campaign folder in Drive', offsetDays: -40 },
  { title: 'Graphics due (carousel + stories)', offsetDays: -30 },
  { title: 'Social copy written', offsetDays: -25 },
  { title: 'Folder to reviewers due', offsetDays: -21 },
  { title: 'Posts scheduled', offsetDays: -14 },
  { title: 'Campaign launch', offsetDays: 0 },
  { title: 'Campaign wrap-up and metrics', offsetDays: 14 },
];

const MAGAZINE_SECTIONS = [
  'Front',
  'Features',
  'Regulars',
  'Events',
  'Sponsored Editorial Reviews',
  'Book Campaigns',
  'Texas Books Preview',
  'Ads',
  'Other',
];

export default function TriggerPage() {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkItemPriority>(WorkItemPriority.MEDIUM);

  // Type-specific fields
  const [pubDate, setPubDate] = useState('');
  const [campaignStartDate, setCampaignStartDate] = useState('');
  const [bookReceivedDate, setBookReceivedDate] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [weekendDate, setWeekendDate] = useState('');
  const [magazineIssue, setMagazineIssue] = useState('');
  const [magazineSection, setMagazineSection] = useState('Features');

  const selectedOption = TRIGGER_OPTIONS.find((o) => o.key === selectedKey) ?? null;
  const selectedType = selectedOption?.type ?? null;

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority(WorkItemPriority.MEDIUM);
    setPubDate('');
    setCampaignStartDate('');
    setBookReceivedDate('');
    setAuthorName('');
    setBookTitle('');
    setEventDate('');
    setEventVenue('');
    setWeekendDate('');
    setMagazineIssue('');
    setMagazineSection('Features');
    setError(null);
  };

  const calculateMilestoneDates = (pubDateStr: string) => {
    const pubDateObj = new Date(pubDateStr);
    return BOOK_CAMPAIGN_MILESTONES.map((m) => {
      const date = new Date(pubDateObj);
      date.setDate(date.getDate() + m.offsetDays);
      return {
        title: m.title,
        date: date.toISOString().split('T')[0],
        offsetDays: m.offsetDays,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey || !selectedType) return;

    setIsLoading(true);
    setError(null);

    try {
      let dueAt: string | null = null;
      let workItemTitle = title;
      let workItemDescription = description;
      let tags: string[] = ['Triggered'];

      if (selectedKey === 'BOOK_CAMPAIGN') {
        if (!pubDate) {
          setError('Publication date is required for book campaigns');
          setIsLoading(false);
          return;
        }
        dueAt = new Date(pubDate).toISOString();
        const milestones = calculateMilestoneDates(pubDate);
        const milestoneText = milestones
          .map((m) => `• ${m.title}: ${formatDate(m.date)}`)
          .join('\n');
        workItemDescription = `${description}\n\n--- MILESTONES ---\n${milestoneText}`;

      } else if (selectedKey === 'SOCIAL_ASSET_REQUEST') {
        if (campaignStartDate) {
          const due = new Date(campaignStartDate);
          due.setDate(due.getDate() - 14);
          dueAt = due.toISOString();
        } else {
          const due = new Date();
          due.setDate(due.getDate() + 7);
          dueAt = due.toISOString();
        }

      } else if (selectedKey === 'SPONSORED_EDITORIAL_REVIEW') {
        if (!bookReceivedDate) {
          setError('Book received date is required');
          setIsLoading(false);
          return;
        }
        const due = new Date(bookReceivedDate);
        due.setDate(due.getDate() + 30);
        dueAt = due.toISOString();
        workItemDescription = `Book received: ${formatDate(bookReceivedDate)}\n\n${description}`;

      } else if (selectedKey === 'TX_BOOK_PREVIEW_LEAD') {
        if (!authorName || !bookTitle) {
          setError('Author name and book title are required');
          setIsLoading(false);
          return;
        }
        workItemTitle = title || `TBP Lead: ${authorName} - ${bookTitle}`;
        const pubInfo = pubDate ? `\nPublication Date: ${formatDate(pubDate)}` : '';
        workItemDescription = `Author: ${authorName}\nBook: ${bookTitle}${pubInfo}\n\n${description}`;
        const due = new Date();
        due.setDate(due.getDate() + 14);
        dueAt = due.toISOString();

      } else if (selectedKey === 'WEBSITE_EVENT') {
        workItemTitle = title || `Event: ${eventVenue || 'TBD'}`;
        const eventInfo = eventDate ? `Event Date: ${formatDate(eventDate)}` : '';
        const venueInfo = eventVenue ? `Venue: ${eventVenue}` : '';
        workItemDescription = `${[eventInfo, venueInfo].filter(Boolean).join('\n')}\n\n${description}`;
        if (eventDate) {
          const due = new Date(eventDate);
          due.setDate(due.getDate() - 3);
          dueAt = due.toISOString();
        } else {
          const due = new Date();
          due.setDate(due.getDate() + 3);
          dueAt = due.toISOString();
        }

      } else if (selectedKey === 'WEEKEND_EVENTS_POST') {
        tags = ['Weekend Events', 'Triggered'];
        if (!weekendDate) {
          setError('Weekend date is required');
          setIsLoading(false);
          return;
        }
        workItemTitle = title || `Weekend Events Post – ${formatDate(weekendDate)}`;
        workItemDescription = `Weekend of: ${formatDate(weekendDate)}\n\n${description}`;
        // Due the day before the weekend
        const due = new Date(weekendDate);
        due.setDate(due.getDate() - 1);
        dueAt = due.toISOString();

      } else if (selectedKey === 'MAGAZINE_ITEM') {
        tags = ['Magazine', 'Triggered'];
        workItemTitle = title || `Magazine: ${magazineSection} – ${magazineIssue || 'TBD'}`;
        workItemDescription = `Issue: ${magazineIssue || 'TBD'}\nSection: ${magazineSection}\n\n${description}`;
        const due = new Date();
        due.setDate(due.getDate() + 7);
        dueAt = due.toISOString();

      } else if (selectedKey === 'ACCESS_REQUEST') {
        const due = new Date();
        due.setDate(due.getDate() + 2);
        dueAt = due.toISOString();
      }

      await api.workItems.create({
        type: selectedType,
        title: workItemTitle || `${WorkItemTypeLabel[selectedType]} Request`,
        description: workItemDescription,
        priority,
        dueAt,
        tags,
      });

      router.push('/board');
    } catch (err) {
      console.error('Failed to create work item:', err);
      setError(err instanceof Error ? err.message : 'Failed to create work item');
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedKey || !selectedOption) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Select a Trigger</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRIGGER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setSelectedKey(opt.key);
                resetForm();
              }}
              className="p-5 bg-white border border-gray-200 rounded-xl text-left hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition shadow-sm group"
            >
              <div className="text-2xl mb-2">{opt.icon}</div>
              <h3 className="font-bold text-gray-800 group-hover:text-indigo-600">{opt.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
        <button
          onClick={() => router.back()}
          className="mt-6 text-gray-500 hover:text-gray-800 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
      <button
        onClick={() => setSelectedKey(null)}
        className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to types
      </button>

      <h2 className="text-2xl font-bold mb-1 text-gray-900">
        New {selectedOption.label}
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Fill in the details below to trigger the workflow.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title - always shown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title / Reference Name
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder={
              selectedKey === 'TX_BOOK_PREVIEW_LEAD'
                ? 'Auto-generated from author/book if empty'
                : selectedKey === 'WEEKEND_EVENTS_POST'
                ? 'Auto-generated from weekend date if empty'
                : selectedKey === 'MAGAZINE_ITEM'
                ? 'Auto-generated from section/issue if empty'
                : 'e.g. Summer Campaign 2024'
            }
          />
        </div>

        {/* BOOK_CAMPAIGN specific fields */}
        {selectedKey === 'BOOK_CAMPAIGN' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publication Date *
              </label>
              <input
                type="date"
                required
                value={pubDate}
                onChange={(e) => setPubDate(e.target.value)}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Milestones will be calculated from this date.
              </p>
            </div>

            {pubDate && (
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <h4 className="text-sm font-bold text-indigo-800 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Campaign Milestones Preview
                </h4>
                <div className="space-y-1 text-xs">
                  {calculateMilestoneDates(pubDate).map((m, i) => (
                    <div key={i} className="flex justify-between text-indigo-700">
                      <span>{m.title}</span>
                      <span className="font-mono">{formatDate(m.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* SOCIAL_ASSET_REQUEST specific fields */}
        {selectedKey === 'SOCIAL_ASSET_REQUEST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Start Date (Optional)
            </label>
            <input
              type="date"
              value={campaignStartDate}
              onChange={(e) => setCampaignStartDate(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Assets will be due 14 days before this date. If not provided, default is 7 days from now.
            </p>
          </div>
        )}

        {/* SPONSORED_EDITORIAL_REVIEW specific fields */}
        {selectedKey === 'SPONSORED_EDITORIAL_REVIEW' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Book Received Date *
            </label>
            <input
              type="date"
              required
              value={bookReceivedDate}
              onChange={(e) => setBookReceivedDate(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Review due date will be set to 30 days after receipt.
            </p>
          </div>
        )}

        {/* TX_BOOK_PREVIEW_LEAD specific fields */}
        {selectedKey === 'TX_BOOK_PREVIEW_LEAD' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author Name *
                </label>
                <input
                  required
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="input"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Book Title *
                </label>
                <input
                  required
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="input"
                  placeholder="The Great Novel"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publication Date (Optional)
              </label>
              <input
                type="date"
                value={pubDate}
                onChange={(e) => setPubDate(e.target.value)}
                className="input"
              />
            </div>
          </>
        )}

        {/* WEBSITE_EVENT specific fields */}
        {selectedKey === 'WEBSITE_EVENT' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Venue
              </label>
              <input
                value={eventVenue}
                onChange={(e) => setEventVenue(e.target.value)}
                className="input"
                placeholder="BookPeople, Austin"
              />
            </div>
          </div>
        )}

        {/* WEEKEND_EVENTS_POST specific fields */}
        {selectedKey === 'WEEKEND_EVENTS_POST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weekend Date *
            </label>
            <input
              type="date"
              required
              value={weekendDate}
              onChange={(e) => setWeekendDate(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Due date will be set to the day before. Task will be tagged "Weekend Events".
            </p>
          </div>
        )}

        {/* MAGAZINE_ITEM specific fields */}
        {selectedKey === 'MAGAZINE_ITEM' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Magazine Issue
              </label>
              <input
                value={magazineIssue}
                onChange={(e) => setMagazineIssue(e.target.value)}
                className="input"
                placeholder="February 2026"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section
              </label>
              <select
                value={magazineSection}
                onChange={(e) => setMagazineSection(e.target.value)}
                className="select"
              >
                {MAGAZINE_SECTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Priority - always shown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as WorkItemPriority)}
            className="select"
          >
            <option value={WorkItemPriority.LOW}>Low</option>
            <option value={WorkItemPriority.MEDIUM}>Medium</option>
            <option value={WorkItemPriority.HIGH}>High</option>
            <option value={WorkItemPriority.URGENT}>Urgent</option>
          </select>
        </div>

        {/* Description - always shown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Details
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="Provide context for the team..."
          />
        </div>

        {/* Submit buttons */}
        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" disabled={isLoading} className="btn-primary flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Create Work Item
          </button>
        </div>
      </form>
    </div>
  );
}
