import React from 'react'
import {
  Wrench,
  Zap,
  Snowflake,
  Car,
  Bike,
  Sparkles,
  Hammer,
  Sun,
  Settings,
  Paintbrush,
  Bug,
  Droplets,
} from 'lucide-react'

export interface ServiceImageLogoProps {
  id?: string | null
  name?: string | null
  icon?: string | null
  imageUrl?: string | null
  gradient?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}

const defaultGradients: Record<string, string> = {
  plumber: 'from-blue-600 via-sky-500 to-cyan-500',
  electrician: 'from-amber-500 via-yellow-500 to-orange-500',
  ac: 'from-sky-500 via-indigo-500 to-blue-600',
  'ac / hvac': 'from-sky-500 via-indigo-500 to-blue-600',
  car: 'from-rose-500 via-red-500 to-orange-500',
  'car workshop': 'from-rose-500 via-red-500 to-orange-500',
  bike: 'from-slate-700 via-slate-600 to-zinc-600',
  'bike mechanic': 'from-slate-700 via-slate-600 to-zinc-600',
  cleaning: 'from-teal-500 via-emerald-500 to-green-500',
  carpenter: 'from-amber-600 via-orange-500 to-amber-700',
  solar: 'from-yellow-500 via-amber-500 to-orange-400',
  appliance: 'from-purple-500 via-violet-500 to-indigo-500',
  'appliance repair': 'from-purple-500 via-violet-500 to-indigo-500',
  painter: 'from-pink-500 via-rose-500 to-fuchsia-500',
  pest: 'from-lime-600 via-green-600 to-emerald-600',
  'pest control': 'from-lime-600 via-green-600 to-emerald-600',
  general: 'from-slate-600 via-gray-600 to-zinc-600',
  'general maintenance': 'from-slate-600 via-gray-600 to-zinc-600',
  handyman: 'from-slate-600 via-gray-600 to-zinc-600',
}

const sizeClasses: Record<string, string> = {
  xs: 'h-6 w-6 rounded-lg',
  sm: 'h-8 w-8 rounded-xl',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
  xl: 'h-16 w-16 rounded-2xl',
  '2xl': 'h-20 w-20 rounded-3xl',
}

const iconSizes: Record<string, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-10 w-10',
}

function resolveKey(str: string): string {
  const lower = str.toLowerCase().trim()
  if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('water') || lower.includes('leak')) return 'plumber'
  if (lower.includes('elect') || lower.includes('wire') || lower.includes('switch') || lower.includes('power')) return 'electrician'
  if (lower.includes('ac') || lower.includes('hvac') || lower.includes('cool') || lower.includes('air') || lower.includes('snowflake')) return 'ac'
  if (lower.includes('car') || lower.includes('auto') || lower.includes('engine')) return 'car'
  if (lower.includes('bike') || lower.includes('motor') || lower.includes('scoot')) return 'bike'
  if (lower.includes('clean') || lower.includes('wash') || lower.includes('sparkl')) return 'cleaning'
  if (lower.includes('carpen') || lower.includes('wood') || lower.includes('furnit') || lower.includes('door') || lower.includes('hammer')) return 'carpenter'
  if (lower.includes('solar') || lower.includes('sun') || lower.includes('invert') || lower.includes('panel')) return 'solar'
  if (lower.includes('appliance') || lower.includes('fridge') || lower.includes('oven') || lower.includes('machin') || lower.includes('setting')) return 'appliance'
  if (lower.includes('paint') || lower.includes('wall')) return 'painter'
  if (lower.includes('pest') || lower.includes('bug') || lower.includes('termite')) return 'pest'
  if (lower.includes('general') || lower.includes('handy') || lower.includes('repair') || lower.includes('wrench') || lower.includes('tool')) return 'general'
  return lower
}

function getLucideIcon(key: string, iconSizeClass: string) {
  switch (key) {
    case 'plumber':
      return <Droplets className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'electrician':
      return <Zap className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'ac':
      return <Snowflake className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'car':
      return <Car className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'bike':
      return <Bike className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'cleaning':
      return <Sparkles className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'carpenter':
      return <Hammer className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'solar':
      return <Sun className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'appliance':
      return <Settings className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'painter':
      return <Paintbrush className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'pest':
      return <Bug className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
    case 'general':
    default:
      return <Wrench className={`${iconSizeClass} text-white`} strokeWidth={2.2} />
  }
}

export function ServiceImageLogo({
  id,
  name,
  icon,
  imageUrl,
  gradient,
  size = 'lg',
  className = '',
}: ServiceImageLogoProps) {
  const resolved = resolveKey(name || id || icon || '')
  const matchedGradient =
    gradient || defaultGradients[resolved] || defaultGradients[name?.toLowerCase() || ''] || 'from-primary via-primary-dark to-purple-800'
  const iconSizeClass = iconSizes[size] || iconSizes.lg

  if (imageUrl) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-slate-100 shadow-soft shrink-0 ${sizeClasses[size] || sizeClasses.lg} ${className}`}
      >
        <img src={imageUrl} alt={name || 'Service Logo'} className="h-full w-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br ${matchedGradient} shadow-soft shrink-0 select-none transition-transform duration-200 group-hover:scale-105 ${sizeClasses[size] || sizeClasses.lg} ${className}`}
    >
      {getLucideIcon(resolved, iconSizeClass)}
    </div>
  )
}

export default ServiceImageLogo
