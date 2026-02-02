'use client';

import { useState } from 'react';
import { useFetch, api } from '@/lib/hooks';
import { formatDate, cn } from '@/lib/utils';
import {
  Calendar,
  Upload,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronRight,
  Plus,
  Loader2,
  Sun,
} from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  venue: string | null;
  location: string | null;
  pipelineStatus: string;
  batchDate: string | null;
  uploadedAt: string | null;
  isWeekendEvent: boolean;
  qcChecklist: string;
}

interface EventsData {
  events: Event[];
  queues: {
    intake: Event[];
    compilation: Event[];
    readyToUpload: Event[];
    uploaded: Event[];
  };
  weekendEvents: Event[];
  nextBatchDate: string;
}

const PIPELINE_STAGES = [
  { key: 'intake', label: 'Intake', icon: Plus, color: 'bg-gray-100' },
  { key: 'compilation', label: 'Compiling', icon: Clock, color: 'bg-yellow-100' },
  { key: 'readyToUpload', label: 'Ready to Upload', icon: Upload, color: 'bg-blue-100' },
  { key: 'uploaded', label: 'Uploaded', icon: CheckCircle2, color: 'bg-green-100' },
];

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'weekend'>('pipeline');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const { data, isLoading, refetch } = useFetch<EventsData>('/api/events', {
    pollInterval: 30000,
  });

  const updateEventStatus = async (eventId: string, newStatus: string) => {
    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: newStatus }),
      });
      refetch();
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  };

  const updateQcChecklist = async (eventId: string, checklist: Record<string, boolean>) => {
    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qcChecklist: checklist }),
      });
      refetch();
    } catch (error) {
      console.error('Failed to update QC checklist:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const queues = data?.queues || { intake: [], compilation: [], readyToUpload: [], uploaded: [] };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Events Pipeline
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Sheet → Compile → Upload workflow
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Next batch:</span>
          <span className="font-medium text-indigo-600">
            {data?.nextBatchDate ? formatDate(data.nextBatchDate) : 'Friday'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={cn(
            'pb-3 text-sm font-medium border-b-2 transition',
            activeTab === 'pipeline'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Friday Pipeline
        </button>
        <button
          onClick={() => setActiveTab('weekend')}
          className={cn(
            'pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2',
            activeTab === 'weekend'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <Sun className="w-4 h-4" />
          Weekend Events
          {data?.weekendEvents && data.weekendEvents.length > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
              {data.weekendEvents.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const events = queues[stage.key as keyof typeof queues] || [];
            const StageIcon = stage.icon;

            return (
              <div key={stage.key} className="bg-white rounded-xl border border-gray-200">
                <div
                  className={cn(
                    'p-3 border-b border-gray-100 flex items-center justify-between',
                    stage.color
                  )}
                >
                  <div className="flex items-center gap-2">
                    <StageIcon className="w-4 h-4" />
                    <span className="font-medium text-sm">{stage.label}</span>
                  </div>
                  <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full">
                    {events.length}
                  </span>
                </div>

                <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {formatDate(event.eventDate)}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </div>
                      )}

                      {/* Quick action to move to next stage */}
                      {stage.key !== 'uploaded' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextStatus =
                              stage.key === 'intake'
                                ? 'COMPILATION'
                                : stage.key === 'compilation'
                                ? 'READY_TO_UPLOAD'
                                : 'UPLOADED';
                            updateEventStatus(event.id, nextStatus);
                          }}
                          className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          Move to next <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  {events.length === 0 && (
                    <div className="text-center text-gray-400 text-sm py-8">
                      No events
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'weekend' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Sun className="w-5 h-5 text-orange-500" />
              Weekend Events (Sunday 5pm deadline)
            </h3>
          </div>

          <div className="space-y-3">
            {data?.weekendEvents?.map((event) => {
              const checklist = JSON.parse(event.qcChecklist || '{}');

              return (
                <div
                  key={event.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-indigo-200 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(event.eventDate)}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded',
                        event.pipelineStatus === 'UPLOADED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      )}
                    >
                      {event.pipelineStatus}
                    </span>
                  </div>

                  {/* QC Checklist */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">QC Checklist:</p>
                    <div className="flex flex-wrap gap-3">
                      {['tagsFound', 'alphabetized', 'formattingChecked'].map((item) => (
                        <label key={item} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checklist[item] || false}
                            onChange={(e) =>
                              updateQcChecklist(event.id, {
                                ...checklist,
                                [item]: e.target.checked,
                              })
                            }
                            className="rounded border-gray-300 text-indigo-600"
                          />
                          {item === 'tagsFound'
                            ? 'Tags Found'
                            : item === 'alphabetized'
                            ? 'Alphabetized'
                            : 'Formatting Checked'}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {(!data?.weekendEvents || data.weekendEvents.length === 0) && (
              <div className="text-center text-gray-400 py-8">
                No weekend events scheduled
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
