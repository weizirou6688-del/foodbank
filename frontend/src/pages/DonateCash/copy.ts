import type {
  DonorQuote,
  GallerySlide,
  GivingMode,
  InfoCardCopy,
  ModeCopy,
} from './model'

export const presetAmounts = [10, 20, 50, 100]
export const gbp = '\u00A3'

export const copyByMode: Record<GivingMode, ModeCopy> = {
  monthly: {
    heading: 'Monthly Giving',
    subtext: 'You are setting up a monthly donation. All fields are required.',
    submitLabel: 'Set Up Monthly Donation',
  },
  one_time: {
    heading: 'One-Time Donation',
    subtext: 'You are making a one-time donation. All fields are required.',
    submitLabel: 'Submit One-Time Donation',
  },
}

export const heroChecks = [
  `${gbp}10 = 1 full food package`,
  `${gbp}20 = Feeds a family for a week`,
  '100% goes directly to people in need',
]

export const helpCards: InfoCardCopy[] = [
  {
    title: 'Emergency Food Parcels',
    description: 'Nutritionally balanced packages containing fresh produce, tinned goods, and essentials.',
  },
  {
    title: 'No Questions Asked',
    description: 'We believe everyone deserves dignity. No forms, no judgement - just support.',
  },
  {
    title: '100% Transparency',
    description: 'Every penny goes directly to purchasing food. Zero administration costs.',
  },
]

export const galleryCards: GallerySlide[] = [
  {
    image:
      'https://images.unsplash.com/photo-1593113630400-ea4288922497?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHZvbHVudGVlcnMlMjBkaXN0cmlidXRpbmd8ZW58MXx8fHwxNzc0OTI4OTU3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Volunteers distributing food',
    title: 'Community Distribution',
  },
  {
    image:
      'https://images.unsplash.com/photo-1584614207146-a64524f5806a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBoZWxwaW5nJTIwZ3JvY2VyaWVzfGVufDF8fHx8MTc3NDkyODk1OHww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Community helping with groceries',
    title: 'Food Collection',
  },
  {
    image:
      'https://images.unsplash.com/photo-1648090229186-6188eaefcc6a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBmb29kJTIwZG9uYXRpb258ZW58MXx8fHwxNzc0OTI4OTU4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Fresh vegetables for donation',
    title: 'Fresh Produce',
  },
]

export const donorQuotes: DonorQuote[] = [
  {
    image:
      'https://images.unsplash.com/photo-1623594675959-02360202d4d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzQ5MzAzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Emma L.',
    name: 'Emma L.',
    meta: 'Monthly donor for 18 months',
    quote: `I've been donating ${gbp}20 a month for over a year now, and it's the best thing I do each month. I love that I get a simple update every month, showing exactly how my donation has helped local families.`,
  },
  {
    image:
      'https://images.unsplash.com/photo-1769636930047-4478f12cf430?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBwb3J0cmFpdCUyMGNvbmZpZGVudHxlbnwxfHx8fDE3NzQ5MzAzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Mark T.',
    name: 'Mark T.',
    meta: 'Monthly donor for 8 months',
    quote:
      'I grew up in a family that used a food bank when I was a kid, so I know exactly what a difference this makes. The transparency here is amazing - I never have to wonder where my money is going.',
  },
]
