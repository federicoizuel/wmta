import prisma from '@/prisma';
import { Newspaper, TrendingUp, Tag, Clock } from 'lucide-react';
import { connection } from 'next/server';

export default async function HomePage() {
  await connection();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch today's top rankings including the topic details
  const rankings = await prisma.dailyRanking.findMany({
    where: {
      date: today,
    },
    include: {
      topic: true,
    },
    orderBy: {
      rank: 'asc',
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 text-center">
          <div className="flex justify-center mb-4">
            <Newspaper className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
            Media Pulse
          </h1>
          <p className="mt-4 text-xl text-slate-600">
            AI-powered daily digest of the stories shaping the world.
          </p>
          <div className="mt-2 flex items-center justify-center text-sm text-slate-400">
            <Clock className="w-4 h-4 mr-1" />
            {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        {rankings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-500">No data found for today yet. Run the update script to see the pulse.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {rankings.map((ranking: any) => (
              <div 
                key={ranking.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md hover:border-blue-200 flex items-start space-x-6"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-700 font-bold text-xl">
                  #{ranking.rank}
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold text-slate-800">
                      {ranking.topic.name}
                    </h2>
                    <div className="flex items-center space-x-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        <Tag className="w-3 h-3 mr-1" />
                        {ranking.topic.category || 'General'}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Score: {ranking.topic.relevanceScore}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-slate-600 text-lg leading-relaxed italic">
                    {ranking.summary || "Summary generation in progress..."}
                  </p>
                  
                  <div className="mt-4 flex items-center text-sm text-blue-600 font-medium hover:underline cursor-pointer">
                    View topic history and related sources →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
