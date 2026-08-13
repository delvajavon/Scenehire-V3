import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ href: '/scenehire-landing.html' })
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
