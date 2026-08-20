"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, BookOpenText, Clock3, Mic2, PenLine, Plus, Search, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { createSignedCloudRecordingUrl, listCloudRecordingHistory, type CloudRecordingRow } from "@/lib/recording-cloud"
import { cn } from "@/lib/utils"

type TextEntry = { id:string; user_id:string; title:string; body:string; created_at:string; updated_at:string }
type JournalItem =
  | { kind:"text"; id:string; title:string; preview:string; createdAt:string; updatedAt:string; body:string }
  | { kind:"audio"; id:string; title:string; preview:string; createdAt:string; duration:number; recording:CloudRecordingRow }

export function JournalClient() {
  const [textEntries,setTextEntries]=useState<TextEntry[]>([])
  const [recordings,setRecordings]=useState<CloudRecordingRow[]>([])
  const [query,setQuery]=useState("")
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const [composerOpen,setComposerOpen]=useState(false)
  const [editing,setEditing]=useState<TextEntry|null>(null)
  const [detail,setDetail]=useState<JournalItem|null>(null)
  const [audioUrl,setAudioUrl]=useState("")
  const [audioLoading,setAudioLoading]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true); setError("")
    try {
      const supabase=createClient()
      const [{data,error:textError},cloudRows]=await Promise.all([
        supabase.from("journal_entries").select("id,user_id,title,body,created_at,updated_at").order("updated_at",{ascending:false}).limit(250),
        listCloudRecordingHistory(),
      ])
      if(textError) throw new Error(textError.message)
      setTextEntries((data??[]) as TextEntry[]); setRecordings(cloudRows)
    } catch(caught) {
      const message=caught instanceof Error?caught.message:"Your Journal could not be loaded."
      if(message.toLowerCase().includes("journal_entries")){
        setError("Journal needs its Supabase migration before written notes can be saved. Your recordings are still private.")
        try{ setRecordings(await listCloudRecordingHistory()) }catch{}
      } else setError(message)
    } finally { setLoading(false) }
  },[])
  useEffect(()=>{void load()},[load])

  const items=useMemo<JournalItem[]>(()=>{
    const texts:JournalItem[]=textEntries.map(e=>({kind:"text",id:e.id,title:e.title,preview:e.body,body:e.body,createdAt:e.created_at,updatedAt:e.updated_at}))
    const audio:JournalItem[]=recordings.map(r=>({kind:"audio",id:r.id,title:r.title?.trim()||"Untitled recording",preview:r.transcript?.trim()||"Private audio recording",createdAt:r.created_at,duration:r.duration_seconds,recording:r}))
    const q=query.trim().toLowerCase()
    return [...texts,...audio].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).filter(item=>!q||`${item.title} ${item.preview}`.toLowerCase().includes(q))
  },[query,recordings,textEntries])

  async function openItem(item:JournalItem){
    setDetail(item); setAudioUrl("")
    if(item.kind!=="audio") return
    setAudioLoading(true)
    try{setAudioUrl(await createSignedCloudRecordingUrl(item.recording.storage_path))}
    catch(caught){setError(caught instanceof Error?caught.message:"That private recording could not be opened.")}
    finally{setAudioLoading(false)}
  }
  function startNewText(){setEditing(null);setComposerOpen(true)}
  function editText(item:Extract<JournalItem,{kind:"text"}>){const entry=textEntries.find(e=>e.id===item.id);if(!entry)return;setDetail(null);setEditing(entry);setComposerOpen(true)}

  return <div className="journal-page min-h-full pb-3">
    <header className="journal-header"><p className="journal-running-head">Tellwise</p><div className="mt-5"><h1>Journal</h1><p className="journal-deck">Raw ideas, before they’re ready to tell.</p></div></header>
    <label className="journal-search"><Search aria-hidden="true"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search entries" aria-label="Search Journal entries"/></label>
    <div className="journal-note-strip"><BookOpenText className="h-4 w-4" strokeWidth={1.7}/><p>Your saved Studio recordings appear here automatically. Written notes stay private too.</p></div>
    {error&&<p className="journal-error">{error}</p>}
    <section className="journal-list" aria-busy={loading}>
      {loading?<><JournalSkeleton/><JournalSkeleton/><JournalSkeleton/></>:items.length?items.map(item=><button key={`${item.kind}-${item.id}`} type="button" className="journal-card" onClick={()=>void openItem(item)}><span className={cn("journal-card-icon",item.kind==="audio"?"is-audio":"is-text")}>{item.kind==="audio"?<Mic2 strokeWidth={1.75}/>:<PenLine strokeWidth={1.75}/>}</span><span className="journal-card-copy"><span className="journal-card-heading-row"><strong>{item.title}</strong><time>{journalDate(item.createdAt)}</time></span><span className="journal-card-preview">{compactPreview(item.preview)}</span><span className={cn("journal-card-type",item.kind==="audio"?"is-audio":"is-text")}>{item.kind==="audio"?`Audio · ${duration(item.duration)}`:"Text"}</span></span></button>):<div className="journal-empty"><PenLine className="h-5 w-5" strokeWidth={1.5}/><h2>{query?"No matching entries":"Your first blank page"}</h2><p>{query?"Try a different search.":"Write down a fragment, or record a story in Studio. Both can live here."}</p></div>}
    </section>
    <button type="button" className="journal-new-entry" onClick={startNewText}><Plus className="h-5 w-5" strokeWidth={1.7}/>New entry</button>
    {composerOpen&&<TextComposer entry={editing} onClose={()=>{setComposerOpen(false);setEditing(null)}} onSaved={async()=>{setComposerOpen(false);setEditing(null);await load()}}/>}
    {detail&&<EntryDetail item={detail} audioUrl={audioUrl} audioLoading={audioLoading} onClose={()=>{setDetail(null);setAudioUrl("")}} onEdit={()=>{if(detail.kind==="text")editText(detail)}} onDeleted={async()=>{setDetail(null);await load()}}/>}
  </div>
}

function TextComposer({entry,onClose,onSaved}:{entry:TextEntry|null;onClose:()=>void;onSaved:()=>void|Promise<void>}){
  const [title,setTitle]=useState(entry?.title??"");const [body,setBody]=useState(entry?.body??"");const [saving,setSaving]=useState(false);const [error,setError]=useState("")
  async function save(){const cleanBody=body.trim();const cleanTitle=title.trim()||titleFromBody(cleanBody);if(!cleanBody){setError("Write something before saving this page.");return}if(cleanTitle.length>120||cleanBody.length>20000){setError("Keep the title under 120 characters and the entry under 20,000 characters.");return}setSaving(true);setError("");try{const supabase=createClient();const {data:authData,error:authError}=await supabase.auth.getUser();if(authError||!authData.user)throw new Error("Please sign in again before saving.");const response=entry?await supabase.from("journal_entries").update({title:cleanTitle,body:cleanBody}).eq("id",entry.id):await supabase.from("journal_entries").insert({user_id:authData.user.id,title:cleanTitle,body:cleanBody});if(response.error)throw new Error(response.error.message);await onSaved()}catch(caught){setError(caught instanceof Error?caught.message:"This entry could not be saved.")}finally{setSaving(false)}}
  return <div className="journal-overlay" role="dialog" aria-modal="true" aria-label={entry?"Edit Journal entry":"New Journal entry"}><div className="journal-editor"><div className="journal-editor-top"><button type="button" onClick={onClose} aria-label="Close editor"><X/></button><span>{entry?"Edit entry":"New entry"}</span><button type="button" onClick={()=>void save()} disabled={saving||!body.trim()}>{saving?"Saving…":"Save"}</button></div><input className="journal-title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Untitled" maxLength={120} autoFocus/><textarea className="journal-body-input" value={body} onChange={e=>setBody(e.target.value)} placeholder="Write the detail you do not want to forget…" maxLength={20000}/><div className="journal-editor-foot"><span>{body.length.toLocaleString()} / 20,000</span><Link href="/studio?mode=free" onClick={onClose}><Mic2/>Record instead</Link></div>{error&&<p className="journal-error mt-3">{error}</p>}</div></div>
}

function EntryDetail({item,audioUrl,audioLoading,onClose,onEdit,onDeleted}:{item:JournalItem;audioUrl:string;audioLoading:boolean;onClose:()=>void;onEdit:()=>void;onDeleted:()=>void|Promise<void>}){
  const [deleting,setDeleting]=useState(false);const [error,setError]=useState("")
  async function deleteText(){if(item.kind!=="text")return;setDeleting(true);setError("");try{const supabase=createClient();const {error:deleteError}=await supabase.from("journal_entries").delete().eq("id",item.id);if(deleteError)throw new Error(deleteError.message);await onDeleted()}catch(caught){setError(caught instanceof Error?caught.message:"This entry could not be deleted.")}finally{setDeleting(false)}}
  return <div className="journal-overlay" role="dialog" aria-modal="true" aria-label="Journal entry"><article className="journal-detail"><div className="journal-detail-top"><button type="button" onClick={onClose} aria-label="Close entry"><ArrowLeft/></button><span>{item.kind==="audio"?"Private recording":"Written note"}</span><button type="button" onClick={onClose} aria-label="Close entry"><X/></button></div><p className="journal-entry-date">{journalLongDate(item.createdAt)}</p><h2>{item.title}</h2>{item.kind==="audio"?<><div className="journal-audio-player">{audioLoading?<span>Opening private audio…</span>:audioUrl?<audio controls preload="metadata" src={audioUrl}/>:<span>Audio unavailable.</span>}</div><p className="journal-detail-body">{item.preview}</p><Link href="/studio/recordings" className="journal-detail-primary"><Clock3/>Open in past recordings</Link></>:<><p className="journal-detail-body whitespace-pre-wrap">{item.body}</p><div className="journal-detail-actions"><button type="button" onClick={onEdit}><PenLine/>Edit</button><button type="button" className="is-danger" disabled={deleting} onClick={()=>void deleteText()}><Trash2/>{deleting?"Deleting…":"Delete"}</button></div></>}{error&&<p className="journal-error mt-3">{error}</p>}</article></div>
}
function JournalSkeleton(){return <div className="journal-card journal-card-skeleton" aria-hidden="true"/>}
function compactPreview(value:string){return value.replace(/\s+/g," ").trim().slice(0,120)||"Private story"}
function titleFromBody(value:string){const sentence=value.split(/[.!?\n]/)[0]?.trim()||"Untitled note";return sentence.split(/\s+/).slice(0,7).join(" ").slice(0,120)}
function duration(seconds:number){const value=Math.max(0,Math.round(seconds||0));return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`}
function journalDate(value:string){const date=new Date(value),now=new Date();if(date.toDateString()===now.toDateString())return date.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}).toLowerCase();const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);if(date.toDateString()===yesterday.toDateString())return "yesterday";return date.toLocaleDateString("en-US",{month:"short",day:"numeric"}).toLowerCase()}
function journalLongDate(value:string){return new Date(value).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
