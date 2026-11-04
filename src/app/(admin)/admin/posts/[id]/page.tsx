'use client'
import { useParams } from 'next/navigation'
import { ContentEditor } from '@/components/admin/content-editor'
export default function PostEditPage() { const { id } = useParams<{ id: string }>(); return <ContentEditor id={id} key={id} /> }
