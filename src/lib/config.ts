export const config = {
  newsApiKey: import.meta.env.VITE_NEWS_API_KEY || '',
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  youtubeApiKey: import.meta.env.VITE_YOUTUBE_API_KEY || '',
  elevenLabsApiKey: import.meta.env.VITE_ELEVENLABS_API_KEY || '',
  twitterClientId: import.meta.env.VITE_TWITTER_CLIENT_ID || '',
  
  get hasNewsApi() { return this.newsApiKey.length > 0; },
  get hasOpenAi() { return this.openaiApiKey.length > 0; },
  get hasGoogleAuth() { return this.googleClientId.length > 0; },
  get hasYoutubeApi() { return this.youtubeApiKey.length > 0; },
  get hasElevenLabs() { return this.elevenLabsApiKey.length > 0; },
};
