import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, FileText, Folder, Handshake, MessageCircle, Search, UserPlus } from 'lucide-react';
import { companyApi, errorMessage } from './companyApi';

const FILTERS = [
  ['all', 'הכול'], ['document', 'מסמכים'], ['project', 'פרויקטים'],
  ['task', 'משימות'], ['lead', 'לידים'], ['deal', 'עסקאות'], ['message', 'הודעות'],
];
const ICONS = {
  document: FileText, project: Folder, lead: UserPlus, deal: Handshake,
  account: Building2, message: MessageCircle,
};

export default function SearchPage({ membership }) {
  const orgId = membership.organization.id;
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value.trim()), 300);
    return () => clearTimeout(timer);
  }, [value]);
  const search = useQuery({
    queryKey: ['company', orgId, 'search', query, type],
    queryFn: () => companyApi.search(orgId, query, type),
    enabled: query.length >= 2,
  });
  const open = (item) => {
    if (item.type === 'project') navigate('/company/projects/' + item.resource_id);
    else if (item.type === 'document') navigate('/company/documents?id=' + item.resource_id);
    else if (['lead', 'deal', 'account'].includes(item.type)) navigate('/company/crm');
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">חיפוש מאובטח</h1>
        <p className="text-sm text-gray-500">התוצאות מסוננות בשרת לפי ההרשאות שלך.</p>
      </div>
      <label className="relative block">
        <Search className="absolute right-3 top-3 text-gray-400" size={20} />
        <input
          autoFocus value={value} onChange={(event) => setValue(event.target.value)}
          placeholder="חיפוש במסמכים, משימות, לקוחות והודעות"
          className="w-full bg-white border rounded-2xl py-3 pr-11 pl-4 shadow-sm"
        />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([key, label]) => (
          <button
            key={key} onClick={() => setType(key)}
            className={'px-3 py-1.5 rounded-full whitespace-nowrap text-sm font-semibold ' +
              (type === key ? 'bg-blue-700 text-white' : 'bg-white border text-gray-600')}
          >
            {label}
          </button>
        ))}
      </div>
      {query.length < 2 && <p className="text-center text-gray-500 py-14">הקלידו לפחות שני תווים כדי להתחיל.</p>}
      {search.isPending && query.length >= 2 && <p className="text-center py-10">מחפש…</p>}
      {search.isError && <p className="text-red-700 text-center py-10">{errorMessage(search.error)}</p>}
      {search.data?.length === 0 && <p className="text-center text-gray-500 py-14">לא נמצאו תוצאות מורשות.</p>}
      <div className="grid gap-2">
        {(search.data || []).map((item) => {
          const Icon = ICONS[item.type] || Search;
          return (
            <button
              key={item.type + ':' + item.id} onClick={() => open(item)}
              className="text-right bg-white border rounded-2xl p-4 flex gap-3 hover:border-blue-300"
            >
              <Icon className="text-blue-700 shrink-0" size={22} />
              <span className="min-w-0">
                <strong className="block truncate">{item.title}</strong>
                <span className="text-xs text-blue-700">{item.subtitle}</span>
                {item.snippet && <span className="block text-sm text-gray-500 line-clamp-2">{item.snippet}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
