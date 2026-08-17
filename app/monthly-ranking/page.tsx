import prisma from '@/prisma';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Newspaper,
  Tag,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';

type MonthlyRankingPageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

type MonthlyTopic = {
  topicId: string;
  name: string;
  category: string | null;
  appearances: number;
  totalRank: number;
  bestRank: number;
  summary: string | null;
};

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);

  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

export default async function MonthlyRankingPage({
  searchParams,
}: MonthlyRankingPageProps) {
  const { month: monthParam } = await searchParams;
  const requestedMonth = Array.isArray(monthParam) ? monthParam[0] : monthParam;

  const rankingDates = await prisma.dailyRanking.findMany({
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'desc' },
  });

  const availableMonths = Array.from(
    new Set(rankingDates.map(({ date }) => toMonthKey(date))),
  );
  const selectedMonth =
    requestedMonth && availableMonths.includes(requestedMonth)
      ? requestedMonth
      : availableMonths[0];
  const selectedMonthRange = selectedMonth ? getMonthRange(selectedMonth) : null;

  const dailyRankings = selectedMonthRange
    ? await prisma.dailyRanking.findMany({
        where: {
          date: { gte: selectedMonthRange.start, lt: selectedMonthRange.end },
        },
        include: { topic: true },
        orderBy: [{ date: 'desc' }, { rank: 'asc' }],
      })
    : [];

  const topicsById = new Map<string, MonthlyTopic>();

  for (const ranking of dailyRankings) {
    const existingTopic = topicsById.get(ranking.topicId);

    if (existingTopic) {
      existingTopic.appearances += 1;
      existingTopic.totalRank += ranking.rank;
      existingTopic.bestRank = Math.min(existingTopic.bestRank, ranking.rank);
      continue;
    }

    topicsById.set(ranking.topicId, {
      topicId: ranking.topicId,
      name: ranking.topic.name,
      category: ranking.topic.category,
      appearances: 1,
      totalRank: ranking.rank,
      bestRank: ranking.rank,
      summary: ranking.summary,
    });
  }

  const monthlyRankings = Array.from(topicsById.values())
    .map((topic) => ({
      ...topic,
      averageRank: topic.totalRank / topic.appearances,
    }))
    .sort(
      (first, second) =>
        second.appearances - first.appearances ||
        first.averageRank - second.averageRank ||
        first.bestRank - second.bestRank ||
        first.name.localeCompare(second.name),
    )
    .slice(0, 50);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <CalendarDays className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Monthly Ranking
          </h1>
          <p className="mt-4 text-xl text-slate-600">
            The stories with the strongest presence throughout each month.
          </p>
          {selectedMonth ? (
            <div className="mt-3 flex items-center justify-center text-sm text-slate-500">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              {formatMonth(selectedMonth)} · {dailyRankings.length} daily ranking entries
            </div>
          ) : null}
          <Link
            href="/"
            className="mt-5 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Daily Ranking
          </Link>
        </header>

        {availableMonths.length > 0 ? (
          <nav
            aria-label="Available ranking months"
            className="mb-8 flex flex-wrap justify-center gap-2"
          >
            {availableMonths.map((month) => {
              const isSelected = month === selectedMonth;

              return (
                <Link
                  key={month}
                  href={`/monthly-ranking?month=${month}`}
                  aria-current={isSelected ? 'page' : undefined}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {formatMonth(month)}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {monthlyRankings.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
            <Newspaper className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <p className="text-slate-500">No monthly ranking data is available yet.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {monthlyRankings.map((topic, index) => (
              <article
                key={topic.topicId}
                className="flex items-start gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xl font-bold text-blue-700">
                  #{index + 1}
                </div>

                <div className="min-w-0 flex-grow">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">{topic.name}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                        <Tag className="mr-1 h-3 w-3" />
                        {topic.category || 'General'}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        <Trophy className="mr-1 h-3 w-3" />
                        Best #{topic.bestRank}
                      </span>
                    </div>
                  </div>

                  <p className="text-lg italic leading-relaxed text-slate-600">
                    {topic.summary || 'Summary generation in progress...'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-blue-700">
                    <span>{topic.appearances} daily appearances</span>
                    <span>Average rank #{topic.averageRank.toFixed(1)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
