import { notFound } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { CourseLesson } from "@/components/lesson/course-lesson"
import { allLessonIds, parseLessonId } from "@/lib/curriculum"

export function generateStaticParams() {
  return allLessonIds().map((lessonId) => ({ lessonId }))
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  const found = parseLessonId(lessonId)
  if (!found) notFound()
  return <MobileShell nav={false} wide><CourseLesson unit={found.unit} stage={found.stage} /></MobileShell>
}
