import React from 'react'
import { cn } from '@/lib/utils'

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  line: string
  color: string
  shadowColor: string
}

type EdgeProps = React.HTMLAttributes<HTMLDivElement> & { line: string }
type AccentTagProps = React.HTMLAttributes<HTMLDivElement> & { color: string }

function surfaceStyle(color: string, shadowColor: string, style?: React.CSSProperties): React.CSSProperties {
  return {
    background: color,
    boxShadow: `0 18px 40px -12px ${shadowColor}`,
    ...style,
  }
}

export type TicketCoverProps = React.HTMLAttributes<HTMLDivElement> & {
  color: string
  shadowColor: string
}

export const TicketCover = React.forwardRef<HTMLDivElement, TicketCoverProps>(
  function TicketCover({ color, shadowColor, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-cover"
        className={cn('overflow-hidden', className)}
        style={surfaceStyle(color, shadowColor, style)}
        {...props}
      />
    )
  },
)

export interface TicketHeaderProps extends SurfaceProps {}

export const TicketHeader = React.forwardRef<HTMLDivElement, TicketHeaderProps>(
  function TicketHeader({ line, color, shadowColor, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-header"
        className={cn('overflow-hidden border-b border-white/50', className)}
        style={{ ...surfaceStyle(color, shadowColor, style), borderColor: line }}
        {...props}
      />
    )
  },
)

export interface TicketFooterProps extends SurfaceProps {}

export const TicketFooter = React.forwardRef<HTMLDivElement, TicketFooterProps>(
  function TicketFooter({ line, color, shadowColor, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-footer"
        className={cn('overflow-hidden border-t border-white/50', className)}
        style={{ ...surfaceStyle(color, shadowColor, style), borderColor: line }}
        {...props}
      />
    )
  },
)

export interface TicketEdgeProps extends EdgeProps {}

export const TicketEdge = React.forwardRef<HTMLDivElement, TicketEdgeProps>(
  function TicketEdge({ line, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-edge"
        className={cn('overflow-hidden', className)}
        style={{ background: line, ...style }}
        {...props}
      />
    )
  },
)

export interface TicketAccentTagProps extends AccentTagProps {}

export const TicketAccentTag = React.forwardRef<HTMLDivElement, TicketAccentTagProps>(
  function TicketAccentTag({ color, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-accent-tag"
        className={className}
        style={{ background: color, ...style }}
        {...props}
      />
    )
  },
)

export interface TicketTripHeaderProps extends SurfaceProps {}

export const TicketTripHeader = React.forwardRef<HTMLDivElement, TicketTripHeaderProps>(
  function TicketTripHeader({ line, color, shadowColor, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-trip-header"
        className={cn('overflow-hidden border-b border-dashed', className)}
        style={{ ...surfaceStyle(color, shadowColor, style), borderColor: line }}
        {...props}
      />
    )
  },
)

export interface TicketTripFooterProps extends SurfaceProps {}

export const TicketTripFooter = React.forwardRef<HTMLDivElement, TicketTripFooterProps>(
  function TicketTripFooter({ line, color, shadowColor, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-trip-footer"
        className={cn('overflow-hidden border-t border-dashed', className)}
        style={{ ...surfaceStyle(color, shadowColor, style), borderColor: line }}
        {...props}
      />
    )
  },
)

export interface TicketTripProps extends SurfaceProps {}

export const TicketTrip = React.forwardRef<HTMLDivElement, TicketTripProps>(
  function TicketTrip({ line, color, shadowColor, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-trip"
        className={cn('overflow-hidden border', className)}
        style={{ ...surfaceStyle(color, shadowColor, style), borderColor: line }}
        {...props}
      />
    )
  },
)

export interface TicketTripFragmentProps extends SurfaceProps {}

export const TicketTripFragment = React.forwardRef<HTMLDivElement, TicketTripFragmentProps>(
  function TicketTripFragment({ line, color, shadowColor, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="ticket-trip-fragment"
        className={className}
        style={{ ...surfaceStyle(color, shadowColor, style), color: line }}
        {...props}
      />
    )
  },
)
