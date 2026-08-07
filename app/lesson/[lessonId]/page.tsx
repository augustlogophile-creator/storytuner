import { notFound, redirect } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { CourseLesson } from "@/components/lesson/course-lesson"
import { allLessonIds, parseLessonId } from "@/lib/curriculum"
import { requireStoryTunerUser } from "@/lib/require-auth"
import { getMembershipByUserId } from "@/lib/membership-server"

export function generateStaticParams() {
  return allLessonIds().map((lessonId) => ({ lessonId }))
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  const user = await requireStoryTunerUser(`/lesson/${lessonId}`)
  const found = parseLessonId(lessonId)
  if (!found) notFound()
  if (found.unit.index > 5) {
    const membership = await getMembershipByUserId(user.id)
    if (!membership.active) redirect("/membership")
  }
  return <MobileShell nav={false}><CourseLesson unit={found.unit} stage={found.stage} /></MobileShell>
}
