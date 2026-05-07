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
  'One-off or recurring monthly donations',
  'Optional: pick which food bank receives your gift',
  'Email receipt and reference number after each charge',
]

export const helpCards: InfoCardCopy[] = [
  {
    title: 'Restocks local inventory',
    description: 'Donations help local food banks restock the pre-made packages and individual items shown on the application page.',
  },
  {
    title: 'Routes to a local team',
    description: 'Pick a specific food bank from the list, or leave it as the default so the notification goes to the platform team.',
  },
  {
    title: 'Counts towards public totals',
    description: 'Each confirmed donation is reflected in the public impact totals on the home page and in the admin dashboard.',
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

export const donorQuotes: DonorQuote[] = []
