export const QUOTES: [string, string][] = [
  ["Small daily improvements are the key to staggering long-term results.", "Unknown"],
  ["The secret of getting ahead is getting started.", "Mark Twain"],
  ["It always seems impossible until it's done.", "Nelson Mandela"],
  ["Success is the sum of small efforts, repeated day in and day out.", "Robert Collier"],
  ["Don't watch the clock; do what it does. Keep going.", "Sam Levenson"],
  ["Mistakes are proof that you are trying.", "Jennifer Lim"],
  ["You don't have to be great to start, but you have to start to be great.", "Zig Ziglar"],
  ["Discipline is choosing between what you want now and what you want most.", "Abraham Lincoln"],
  ["The expert in anything was once a beginner.", "Helen Hayes"],
  ["Focus on being productive instead of busy.", "Tim Ferriss"],
  ["وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ", "النجم ٣٩"],
  ["من جدّ وجد، ومن زرع حصد.", "مثل عربي"],
  ["An hour of focus beats a day of distraction.", "Unknown"],
  ["Every wrong answer you review is a mark you won't lose twice.", "YEX"],
];

export function quoteOfTheDay(d = new Date()) {
  const day = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  return QUOTES[day % QUOTES.length];
}
