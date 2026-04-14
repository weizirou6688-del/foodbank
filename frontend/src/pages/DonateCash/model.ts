import type { CashDonationFrequency } from '@/shared/types/donations'

export type FormNotice = {
  type: 'success' | 'error'
  message: string
}

export type GivingMode = CashDonationFrequency

export type CardForm = {
  email: string
  donorName: string
  cardNumber: string
  expiryDate: string
  securityCode: string
}

export type ModeCopy = {
  heading: string
  subtext: string
  submitLabel: string
}

export type InfoCardCopy = {
  title: string
  description: string
}

export type GallerySlide = {
  image: string
  alt: string
  title: string
}

export type DonorQuote = {
  image: string
  alt: string
  name: string
  meta: string
  quote: string
}
