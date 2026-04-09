import { config } from './config';
import type { NewsItem, Category, TrustedSource } from '../types';

const SOURCE_DOMAINS: Record<TrustedSource, string> = {
  'BBC': 'bbc.co.uk',
  'Reuters': 'reuters.com',
  'The New York Times': 'nytimes.com',
  'Bloomberg': 'bloomberg.com',
  'The Guardian': 'theguardian.com',
  'CNBC': 'cnbc.com',
};

const CATEGORY_QUERIES: Record<Category, string> = {
  tech: 'technology OR AI OR startup OR software',
  politics: 'politics OR election OR government OR policy',
  finance: 'finance OR economy OR stock market OR cryptocurrency',
  sports: 'sports OR football OR basketball OR olympics',
  entertainment: 'entertainment OR movie OR music OR celebrity',
  world: 'world news OR international OR global',
};

function categorizeArticle(title: string, description: string): Category {
  const text = `${title} ${description}`.toLowerCase();
  if (/tech|ai |artificial intelligence|software|startup|crypto|blockchain|app |digital/.test(text)) return 'tech';
  if (/politic|election|government|congress|senate|parliament|president|democrat|republican/.test(text)) return 'politics';
  if (/financ|econom|stock|market|bank|invest|trading|gdp|inflation/.test(text)) return 'finance';
  if (/sport|football|soccer|basketball|tennis|olympic|nba|nfl|fifa/.test(text)) return 'sports';
  if (/entertain|movie|film|music|celebrity|award|oscar|grammy|netflix/.test(text)) return 'entertainment';
  return 'world';
}

function getTrustedSource(sourceName: string): TrustedSource | null {
  const name = sourceName.toLowerCase();
  if (name.includes('bbc')) return 'BBC';
  if (name.includes('reuters')) return 'Reuters';
  if (name.includes('new york times') || name.includes('nyt')) return 'The New York Times';
  if (name.includes('bloomberg')) return 'Bloomberg';
  if (name.includes('guardian')) return 'The Guardian';
  if (name.includes('cnbc')) return 'CNBC';
  return null;
}

export async function fetchNews(category?: Category, query?: string): Promise<NewsItem[]> {
  if (!config.hasNewsApi) {
    return generateDemoNews(category);
  }

  try {
    const domains = Object.values(SOURCE_DOMAINS).join(',');
    const q = query || (category ? CATEGORY_QUERIES[category] : 'trending news today');
    
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&domains=${domains}&sortBy=publishedAt&pageSize=30&language=en`,
      { headers: { 'X-Api-Key': config.newsApiKey } }
    );
    
    if (!response.ok) throw new Error('News API request failed');
    
    const data = await response.json();
    
    return data.articles
      .filter((a: any) => a.title && a.description && a.title !== '[Removed]')
      .map((article: any, index: number) => {
        const source = getTrustedSource(article.source?.name || '');
        if (!source) return null;
        
        return {
          id: `news-${Date.now()}-${index}`,
          title: article.title,
          description: article.description,
          explanation: '',
          whyTrending: '',
          whyMatters: '',
          category: categorizeArticle(article.title, article.description),
          source: source,
          sourceUrl: article.url,
          imageUrl: article.urlToImage || '/images/hero-bg.jpg',
          publishedAt: article.publishedAt,
          trendScore: Math.floor(Math.random() * 40) + 60,
          tags: [],
        } as NewsItem;
      })
      .filter(Boolean) as NewsItem[];
  } catch (error) {
    console.error('News API error:', error);
    return generateDemoNews(category);
  }
}

export async function searchNews(query: string): Promise<NewsItem[]> {
  return fetchNews(undefined, query);
}

function generateDemoNews(category?: Category): NewsItem[] {
  const demoStories: Omit<NewsItem, 'id'>[] = [
    {
      title: 'AI Revolution: OpenAI Unveils Next-Generation Language Model',
      description: 'OpenAI has announced its latest breakthrough in artificial intelligence, introducing a model that demonstrates unprecedented reasoning capabilities.',
      explanation: "OpenAI has just pulled back the curtain on what many are calling the most significant leap in artificial intelligence since the original ChatGPT launch. The new model doesn't just process text — it reasons, plans, and adapts in ways that blur the line between machine computation and human-like thinking. Early benchmarks show it outperforming previous models by a staggering margin on complex tasks like scientific research, coding, and creative writing.\n\nWhat makes this particularly groundbreaking is the model's ability to understand context across incredibly long conversations and documents, essentially giving it a form of 'working memory' that previous AI systems lacked. Industry experts are already predicting this will accelerate AI adoption across healthcare, education, and finance within months, not years.",
      whyTrending: 'This represents a paradigm shift in AI capabilities that will directly impact millions of jobs and reshape entire industries. The tech world is buzzing because this isn\'t incremental improvement — it\'s a generational leap.',
      whyMatters: 'The implications extend far beyond Silicon Valley. This technology will influence how we learn, work, create, and make decisions. Governments worldwide are scrambling to update regulations in response.',
      category: 'tech',
      source: 'Reuters',
      sourceUrl: 'https://reuters.com',
      imageUrl: '/images/category-tech.jpg',
      publishedAt: new Date().toISOString(),
      trendScore: 98,
      viralAngle: 'The "AI is coming for your job" narrative is powerful — but flip it to show how creators can use this to 10x their output.',
      bestContentAngle: 'Create a "What I made with the new AI in 24 hours" challenge video.',
      tags: ['AI', 'OpenAI', 'Technology', 'Future'],
    },
    {
      title: 'Global Markets Surge as Federal Reserve Signals Rate Cuts',
      description: 'Stock markets worldwide rallied after the Federal Reserve indicated potential interest rate reductions in the coming months.',
      explanation: "Wall Street just had one of its best days in months, and the ripple effects are being felt in every major market from Tokyo to London. The Federal Reserve, America's central bank that essentially controls the cost of borrowing money, has strongly hinted that it's ready to start cutting interest rates. For everyday people, this means mortgages, car loans, and credit card rates could all start coming down.\n\nBut here's the bigger picture: when the Fed cuts rates, it's essentially injecting rocket fuel into the economy. Businesses can borrow more cheaply to expand, startups find it easier to get funding, and consumers feel more confident spending. The S&P 500 jumped over 2% in a single session, adding hundreds of billions in market value. Crypto markets also surged, with Bitcoin crossing key resistance levels.",
      whyTrending: 'Money talks, and when the Fed hints at rate cuts, everyone listens. This affects everything from your mortgage payment to your retirement savings.',
      whyMatters: 'Rate cuts signal the Fed believes inflation is under control enough to stimulate growth. This could mark the beginning of a new bull market cycle.',
      category: 'finance',
      source: 'Bloomberg',
      sourceUrl: 'https://bloomberg.com',
      imageUrl: '/images/category-finance.jpg',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      trendScore: 94,
      viralAngle: 'Break down what rate cuts mean for the average 25-year-old in simple terms. Financial literacy content always performs.',
      bestContentAngle: '"What the Fed just did will change your wallet" — hook with personal finance angle.',
      tags: ['Finance', 'Federal Reserve', 'Markets', 'Economy'],
    },
    {
      title: 'Historic Climate Agreement Reached at UN Summit',
      description: 'World leaders have agreed to the most ambitious climate targets ever set, committing to dramatic emissions reductions by 2030.',
      explanation: "After two weeks of intense negotiations that nearly collapsed multiple times, 195 nations have signed what's being called the most consequential climate deal since the Paris Agreement. The new accord commits countries to cutting carbon emissions by 60% before 2030 — a target that scientists say is necessary to avoid the worst effects of climate change but that many thought was politically impossible.\n\nThe breakthrough came when the world's largest polluters — the US, China, and India — agreed to a novel financing mechanism that will funnel $500 billion annually to developing nations for clean energy transitions. This addresses the long-standing argument from poorer countries that they shouldn't bear the cost of a problem created primarily by wealthy nations. Environmental groups are cautiously optimistic, noting that the real test will be implementation.",
      whyTrending: 'Climate change is the defining issue of our generation, and this deal represents the most aggressive action ever taken at a global level.',
      whyMatters: 'This agreement will reshape energy markets, create millions of green jobs, and potentially determine whether we can limit global warming to survivable levels.',
      category: 'politics',
      source: 'The Guardian',
      sourceUrl: 'https://theguardian.com',
      imageUrl: '/images/category-politics.jpg',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      trendScore: 91,
      viralAngle: 'Use before/after visuals of climate impact. Emotional content drives shares.',
      bestContentAngle: '"The deal that could save the planet — or is it too late?" Create urgency and debate.',
      tags: ['Climate', 'UN', 'Environment', 'Politics'],
    },
    {
      title: 'Champions League Final Delivers Instant Classic',
      description: 'An extraordinary match saw a dramatic last-minute winner that sent fans into delirium across the globe.',
      explanation: "Sports fans just witnessed what many are already calling the greatest Champions League final ever played. In a match that had everything — stunning goals, controversial decisions, and a last-gasp winner — the beautiful game reminded us why billions of people around the world stop everything to watch. The underdog story alone is the stuff of movies: a team that barely qualified for the tournament defeating the overwhelming favorites on the biggest stage in club football.\n\nThe decisive moment came in the 94th minute when a perfectly weighted through ball found the striker who had been doubted all season. His finish was ice-cold, sending the ball into the bottom corner as 80,000 fans erupted. Social media exploded with over 50 million tweets in the hour following the goal, making it the most-discussed sporting event of the year. The losing side's manager was gracious in defeat, calling it 'the cruelest and most beautiful game.'",
      whyTrending: 'Last-minute drama in the biggest club football match of the year. The emotional rollercoaster has captivated even non-football fans.',
      whyMatters: 'Beyond the sport, this final generated over $4 billion in economic activity and was watched by an estimated 800 million people worldwide.',
      category: 'sports',
      source: 'BBC',
      sourceUrl: 'https://bbc.com',
      imageUrl: '/images/category-sports.jpg',
      publishedAt: new Date(Date.now() - 10800000).toISOString(),
      trendScore: 96,
      viralAngle: 'Reaction videos and "where were you when" content. Emotional sports moments are goldmines.',
      bestContentAngle: 'Capture the raw emotion — fan reactions, player celebrations, the underdog narrative.',
      tags: ['Sports', 'Football', 'Champions League', 'Drama'],
    },
    {
      title: 'Streaming Wars Intensify: Major Studio Launches Free Tier',
      description: 'A major entertainment studio has shaken up the streaming landscape by introducing a completely free, ad-supported tier with premium content.',
      explanation: "The streaming wars just got a whole lot more interesting. One of Hollywood's biggest studios has made a bold move that could reshape how we consume entertainment: launching a completely free tier of their streaming service that includes access to blockbuster movies and hit TV shows, supported entirely by advertising. This isn't the usual free tier with limited content — we're talking about A-list productions available at no cost.\n\nThe strategy is a direct response to 'subscription fatigue,' where consumers are cutting back on the number of streaming services they pay for. Industry data shows the average household went from subscribing to 4.7 services down to 3.1 in the past year. By going free, this studio is betting that capturing eyeballs and advertising dollars is more valuable than subscription revenue. Wall Street seems to agree — the company's stock jumped 15% on the announcement, adding billions to its market cap.",
      whyTrending: 'Everyone pays for streaming, and the idea of getting premium content for free is universally exciting. This could trigger a domino effect across the industry.',
      whyMatters: 'This signals a fundamental shift in the entertainment business model. If successful, it could mean the end of the subscription-only era and a return to ad-supported content.',
      category: 'entertainment',
      source: 'CNBC',
      sourceUrl: 'https://cnbc.com',
      imageUrl: '/images/category-entertainment.jpg',
      publishedAt: new Date(Date.now() - 14400000).toISOString(),
      trendScore: 88,
      viralAngle: 'Everyone has an opinion on streaming prices. Tap into the frustration and excitement.',
      bestContentAngle: '"The end of paying for streaming?" — provocative take that drives engagement.',
      tags: ['Entertainment', 'Streaming', 'Business', 'Hollywood'],
    },
    {
      title: 'Breakthrough Drug Shows Promise Against Aggressive Cancer Types',
      description: 'Clinical trials reveal a new immunotherapy drug achieving remarkable remission rates in previously untreatable cancers.',
      explanation: "Medical researchers have announced results that are being described as a potential turning point in cancer treatment. A new immunotherapy drug, developed over 15 years of painstaking research, has shown extraordinary results in Phase 3 clinical trials against some of the most aggressive and hard-to-treat cancer types. The drug works by essentially reprogramming the body's own immune system to recognize and destroy cancer cells that previously flew under the radar.\n\nThe numbers are striking: 73% of patients with advanced-stage cancers that had resisted all other treatments showed significant tumor reduction, with 34% achieving complete remission. For context, previous treatments for these cancer types had success rates below 10%. The lead researcher, speaking at a major medical conference, was visibly emotional when presenting the data, saying 'We've been working toward this moment for over a decade.' The drug is now on a fast-track approval pathway and could be available to patients within 18 months.",
      whyTrending: 'Cancer affects nearly every family on Earth. A genuine breakthrough in treatment gives hope to millions and represents one of the most important medical advances in years.',
      whyMatters: 'If the results hold up in broader use, this drug could save hundreds of thousands of lives annually and fundamentally change how we approach cancer treatment.',
      category: 'tech',
      source: 'The New York Times',
      sourceUrl: 'https://nytimes.com',
      imageUrl: '/images/category-tech.jpg',
      publishedAt: new Date(Date.now() - 18000000).toISOString(),
      trendScore: 93,
      viralAngle: 'Hope-driven content performs incredibly well. Lead with the human stories behind the science.',
      bestContentAngle: '"The drug that could change everything" — combine the science with personal patient stories.',
      tags: ['Health', 'Science', 'Cancer', 'Medical'],
    },
    {
      title: 'Electric Vehicle Sales Surpass Combustion Engines in Major Market',
      description: 'For the first time in history, electric vehicle sales have overtaken traditional combustion engine cars in a major European market.',
      explanation: "A milestone that many predicted was still years away has arrived ahead of schedule. Electric vehicles have officially outsold traditional gasoline and diesel cars in one of Europe's largest automotive markets for the first time ever. This isn't a one-month anomaly — the trend has been building for quarters, and industry analysts now say the tipping point has been permanently crossed. The shift was driven by a perfect storm of falling EV prices, expanding charging infrastructure, and generous government incentives.\n\nWhat's particularly noteworthy is that this shift happened faster than even the most optimistic projections suggested. Just three years ago, EVs represented less than 15% of new car sales in this market. Today, they command over 51%. The ripple effects are already being felt: traditional automakers are accelerating their EV timelines, oil companies are diversifying faster, and the used car market for combustion vehicles is seeing unprecedented price drops. This is no longer a question of if the world will go electric — it's a question of how fast.",
      whyTrending: 'The car industry is one of the largest on Earth, and this marks an irreversible shift. Everyone who drives is affected.',
      whyMatters: 'This transition will reshape global energy markets, create new industries, eliminate others, and significantly impact carbon emissions.',
      category: 'tech',
      source: 'Reuters',
      sourceUrl: 'https://reuters.com',
      imageUrl: '/images/category-tech.jpg',
      publishedAt: new Date(Date.now() - 21600000).toISOString(),
      trendScore: 85,
      viralAngle: 'The "future is here" angle always works. Show the contrast between predictions and reality.',
      bestContentAngle: '"Your next car will be electric — here\'s why" — make it personal and inevitable.',
      tags: ['EV', 'Automotive', 'Technology', 'Climate'],
    },
    {
      title: 'Central Bank Digital Currency Launches in G7 Nation',
      description: 'A G7 country has officially launched its central bank digital currency, marking a historic shift in how money works.',
      explanation: "The future of money just became the present. A major G7 economy has officially launched its central bank digital currency (CBDC), making it the first advanced economy to offer a government-backed digital alternative to physical cash. Unlike cryptocurrencies like Bitcoin, this digital currency is issued and guaranteed by the central bank, meaning it carries the same trust and stability as traditional currency but exists entirely in digital form.\n\nThe implications are enormous. Transactions that previously took days to settle now happen in seconds. Cross-border payments that cost significant fees are now nearly free. And for the estimated 1.4 billion adults worldwide who don't have bank accounts, digital currency accessible through a simple smartphone could be transformative. However, privacy advocates have raised concerns about the government's ability to track every transaction. The central bank has responded by implementing privacy protections, but the debate is far from settled. Other G7 nations are watching closely, with several expected to follow suit within the next two years.",
      whyTrending: 'Digital currency from a major government is a paradigm shift in finance. It affects every person who uses money — which is everyone.',
      whyMatters: 'This could eventually replace physical cash, reshape banking, and give governments new tools for monetary policy. It\'s the biggest change in money since credit cards.',
      category: 'finance',
      source: 'Bloomberg',
      sourceUrl: 'https://bloomberg.com',
      imageUrl: '/images/category-finance.jpg',
      publishedAt: new Date(Date.now() - 25200000).toISOString(),
      trendScore: 87,
      viralAngle: 'The "end of cash" narrative is powerful and polarizing. Great for debate-style content.',
      bestContentAngle: '"Your government just created its own crypto" — simplify the complex and make it relatable.',
      tags: ['CBDC', 'Finance', 'Digital Currency', 'Banking'],
    },
  ];

  let stories = demoStories;
  if (category) {
    stories = demoStories.filter(s => s.category === category);
    if (stories.length === 0) stories = demoStories;
  }

  return stories.map((story, index) => ({
    ...story,
    id: `demo-${Date.now()}-${index}`,
  }));
}
