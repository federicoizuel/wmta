import { NextResponse } from 'next/server';
import prisma from '@/prisma';
import OpenAI from 'openai';
import Parser from 'rss-parser';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const parser = new Parser();

export async function GET(request: Request) {
  // 1. Security Check (Optional but recommended for Vercel Cron)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('Cron job started.');

  try {
    // 2. Fetch Active Media Sources
    const sources = await prisma.mediaSource.findMany({
      where: { active: true },
    });

    // 3. Data Ingestion: Fetch headlines from multiple Global RSS feeds
    console.log(`Found ${sources.length} active media sources.`);
    const FEEDS = [
      'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
      'http://feeds.bbci.co.uk/news/world/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://rss.dw.com/rdf/rss-en-all',
      'https://www.theguardian.com/world/rss',
      'https://www.france24.com/en/rss',
      'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada',
      'http://rss.cnn.com/rss/edition_world.rss'
    ];

    const feedPromises = FEEDS.map(async (url) => {
      try {
        // Mejorar la verificación de la respuesta de fetch
        // para capturar errores HTTP antes de intentar parsear el XML.
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const xml = await response.text();
        return await parser.parseString(xml);
      } catch (e) {
        console.error(`Failed to fetch feed: ${url}`, e);
        return null;
      }
    });
    
    const results = await Promise.all(feedPromises);
    
    // Flatten all items from all feeds into a single array of titles
    const headlines = results
      .filter((feed): feed is NonNullable<typeof feed> => !!feed)
      .flatMap(feed => feed.items.map(item => item.title))
      .filter(Boolean);
    
    console.log(`Fetched ${headlines.length} headlines from RSS feeds.`);
    if (headlines.length === 0) {
      console.warn('No headlines were fetched. Skipping AI analysis and database update.');
      return NextResponse.json({ success: true, message: 'No headlines to process.' });
    }

    // 4. AI Analysis via OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Analyze these headlines and extract the top 50 most significant and followable news topics.
            
            Rules for topic names:
            1. Focus on broad, persistent themes and ongoing umbrella stories followable over months, not transient daily developments.
            2. Never use generic or compound titles (avoid "and", "or", "&", "Issues", or "Developments").
            3. Use fundamental names of conflicts, entities, or major recurring events (e.g., "Iran Conflict" instead of "War Powers Resolution", "Gaza Conflict", "US Elections 2024").
            Return JSON: { "topics": [{ "name": "Persistent Topic Name", "score": 95, "category": "Politics", "summary": "..." }] }
            Headlines:\n${headlines.slice(0, 400).join('\n')}`,
            // Limitar la entrada a OpenAI para evitar exceder el límite de tokens
            // y para que el log sea manejable.
            // Considera ajustar el slice si 400 es demasiado o muy poco.
        },
      ],
      response_format: { type: "json_object" },
    });

    const aiResponseText = completion.choices[0].message.content;
    console.log('OpenAI raw response:', aiResponseText);

    if (!aiResponseText) {
      throw new Error("Empty AI response");
    }
    const data = JSON.parse(aiResponseText);

    if (!data.topics || !Array.isArray(data.topics)) {
      throw new Error('Invalid AI response format: topics array missing');
    }

    // 5. Database Persistence (The "Historic Tracking" Logic)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar al inicio del día para el campo @db.Date
    console.log(`OpenAI returned ${data.topics.length} topics.`);
    console.log(`Processing for date: ${today.toISOString().split('T')[0]}`);

    // Use a transaction to clear existing rankings for today and add new ones (idempotency)
    const transactionResult = await prisma.$transaction([
      prisma.dailyRanking.deleteMany({ where: { date: today } }),
      ...data.topics.map((item: any, index: number) =>
        prisma.dailyRanking.create({
        data: {
          date: today,
          rank: index + 1,
          summary: item.summary,
          topic: {
            connectOrCreate: {
              where: { name: item.name },
              create: {
                name: item.name,
                category: item.category,
                relevanceScore: item.score || 0,
              },
            },
          },
        },
      })),
    ], {
      timeout: 20000 // Aumentamos el tiempo de espera a 20 segundos
    });

    const deleteResult = transactionResult[0] as { count: number };
    const createdRankings = transactionResult.slice(1);
    console.log(`Deleted ${deleteResult.count} existing daily rankings for today.`);
    console.log(`Created ${createdRankings.length} new daily rankings.`);

    // Update last scan time for sources
    await prisma.mediaSource.updateMany({
      where: { id: { in: sources.map((s: any) => s.id) } },
      data: { lastScan: today },
    });

    return NextResponse.json({ success: true, topicsProcessed: data.topics.length });

  } catch (error) {
    console.error('Cron Job Failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}