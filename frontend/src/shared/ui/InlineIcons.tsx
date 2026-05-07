import {
  ArrowRight as ArrowRightIcon,
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CircleAlert as AlertCircleIcon,
  ExternalLink as ExternalLinkIcon,
  Mail as MailIcon,
  MapPin as MapPinIcon,
  MapPinned as MapPinAltIcon,
  Minus as MinusIcon,
  Phone as PhoneIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Send as SendIcon,
  ShieldCheck as ShieldCheckIcon,
  TrendingDown,
  TrendingUp,
  X as XIcon,
  type LucideProps,
} from "lucide-react";

type IconProps = LucideProps;

export const Plus = PlusIcon;
export const Minus = MinusIcon;
export const X = XIcon;
export const Check = CheckIcon;
export const ArrowRight = ArrowRightIcon;
export const AlertCircle = AlertCircleIcon;
export const ChevronLeft = ChevronLeftIcon;
export const ChevronRight = ChevronRightIcon;
export const MapPin = MapPinIcon;
export const MapPinAlt = MapPinAltIcon;
export const Search = SearchIcon;
export const ExternalLink = ExternalLinkIcon;
export const Mail = MailIcon;
export const Phone = PhoneIcon;
export const Send = SendIcon;
export const ShieldCheck = ShieldCheckIcon;

export function TrendArrow({
  positive = true,
  ...props
}: IconProps & { positive?: boolean }) {
  return positive ? <TrendingUp {...props} /> : <TrendingDown {...props} />;
}
