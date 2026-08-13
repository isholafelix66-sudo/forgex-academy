/**
 * Curated lucide-react barrel.
 *
 * The real `lucide-react` entry re-exports ~1,900 icon modules; loading it
 * pulls every one of them into the build module graph, which is the single
 * biggest contributor to the production build's peak memory (the platform
 * build was being OOM-killed during chunk rendering).
 *
 * This module re-exports ONLY the icons the app imports, each from its own
 * file (`lucide-react/dist/esm/icons/<name>.js`). vite.config.ts aliases
 * the exact specifier `lucide-react` to this file, so `import { X } from
 * "lucide-react"` resolves here while deep imports stay untouched.
 *
 * If a new `lucide-react` import is added anywhere, add its name to this
 * list (the build fails loudly with "X is not exported by lucide-react"
 * otherwise).
 */
export { default as AlertCircle } from "lucide-react/dist/esm/icons/alert-circle.js";
export { default as AlertTriangle } from "lucide-react/dist/esm/icons/alert-triangle.js";
export { default as Archive } from "lucide-react/dist/esm/icons/archive.js";
export { default as ArchiveRestore } from "lucide-react/dist/esm/icons/archive-restore.js";
export { default as ArrowDown } from "lucide-react/dist/esm/icons/arrow-down.js";
export { default as ArrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
export { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
export { default as ArrowUp } from "lucide-react/dist/esm/icons/arrow-up.js";
export { default as ArrowUpRight } from "lucide-react/dist/esm/icons/arrow-up-right.js";
export { default as Award } from "lucide-react/dist/esm/icons/award.js";
export { default as BadgeCheck } from "lucide-react/dist/esm/icons/badge-check.js";
export { default as Ban } from "lucide-react/dist/esm/icons/ban.js";
export { default as BarChart3 } from "lucide-react/dist/esm/icons/bar-chart-3.js";
export { default as Bell } from "lucide-react/dist/esm/icons/bell.js";
export { default as BellRing } from "lucide-react/dist/esm/icons/bell-ring.js";
export { default as BookOpen } from "lucide-react/dist/esm/icons/book-open.js";
export { default as Bot } from "lucide-react/dist/esm/icons/bot.js";
export { default as Braces } from "lucide-react/dist/esm/icons/braces.js";
export { default as Briefcase } from "lucide-react/dist/esm/icons/briefcase.js";
export { default as CalendarClock } from "lucide-react/dist/esm/icons/calendar-clock.js";
export { default as CalendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
export { default as Camera } from "lucide-react/dist/esm/icons/camera.js";
export { default as Check } from "lucide-react/dist/esm/icons/check.js";
export { default as CheckCheck } from "lucide-react/dist/esm/icons/check-check.js";
export { default as CheckCircle2 } from "lucide-react/dist/esm/icons/check-circle-2.js";
export { default as CheckIcon } from "lucide-react/dist/esm/icons/check.js";
export { default as ChevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
export { default as ChevronDownIcon } from "lucide-react/dist/esm/icons/chevron-down.js";
export { default as ChevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
export { default as ChevronLeftIcon } from "lucide-react/dist/esm/icons/chevron-left.js";
export { default as ChevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
export { default as ChevronRightIcon } from "lucide-react/dist/esm/icons/chevron-right.js";
export { default as ChevronUpIcon } from "lucide-react/dist/esm/icons/chevron-up.js";
export { default as CircleCheckIcon } from "lucide-react/dist/esm/icons/circle-check.js";
export { default as CircleIcon } from "lucide-react/dist/esm/icons/circle.js";
export { default as Clapperboard } from "lucide-react/dist/esm/icons/clapperboard.js";
export { default as ClipboardCheck } from "lucide-react/dist/esm/icons/clipboard-check.js";
export { default as ClipboardList } from "lucide-react/dist/esm/icons/clipboard-list.js";
export { default as Clock } from "lucide-react/dist/esm/icons/clock.js";
export { default as Clock3 } from "lucide-react/dist/esm/icons/clock-3.js";
export { default as CloudUpload } from "lucide-react/dist/esm/icons/cloud-upload.js";
export { default as Code2 } from "lucide-react/dist/esm/icons/code-2.js";
export { default as Compass } from "lucide-react/dist/esm/icons/compass.js";
export { default as Copy } from "lucide-react/dist/esm/icons/copy.js";
export { default as CornerDownRight } from "lucide-react/dist/esm/icons/corner-down-right.js";
export { default as Download } from "lucide-react/dist/esm/icons/download.js";
export { default as Eraser } from "lucide-react/dist/esm/icons/eraser.js";
export { default as ExternalLink } from "lucide-react/dist/esm/icons/external-link.js";
export { default as Eye } from "lucide-react/dist/esm/icons/eye.js";
export { default as EyeOff } from "lucide-react/dist/esm/icons/eye-off.js";
export { default as FileText } from "lucide-react/dist/esm/icons/file-text.js";
export { default as Film } from "lucide-react/dist/esm/icons/film.js";
export { default as Flame } from "lucide-react/dist/esm/icons/flame.js";
export { default as FlaskConical } from "lucide-react/dist/esm/icons/flask-conical.js";
export { default as GalleryHorizontalEnd } from "lucide-react/dist/esm/icons/gallery-horizontal-end.js";
export { default as Globe } from "lucide-react/dist/esm/icons/globe.js";
export { default as GraduationCap } from "lucide-react/dist/esm/icons/graduation-cap.js";
export { default as GripVerticalIcon } from "lucide-react/dist/esm/icons/grip-vertical.js";
export { default as Heart } from "lucide-react/dist/esm/icons/heart.js";
export { default as HeartHandshake } from "lucide-react/dist/esm/icons/heart-handshake.js";
export { default as Home } from "lucide-react/dist/esm/icons/home.js";
export { default as ImageDown } from "lucide-react/dist/esm/icons/image-down.js";
export { default as ImageIcon } from "lucide-react/dist/esm/icons/image.js";
export { default as ImageOff } from "lucide-react/dist/esm/icons/image-off.js";
export { default as ImagePlus } from "lucide-react/dist/esm/icons/image-plus.js";
export { default as Inbox } from "lucide-react/dist/esm/icons/inbox.js";
export { default as InfoIcon } from "lucide-react/dist/esm/icons/info.js";
export { default as KeyRound } from "lucide-react/dist/esm/icons/key-round.js";
export { default as Layers } from "lucide-react/dist/esm/icons/layers.js";
export { default as LayoutDashboard } from "lucide-react/dist/esm/icons/layout-dashboard.js";
export { default as Link2 } from "lucide-react/dist/esm/icons/link-2.js";
export { default as ListChecks } from "lucide-react/dist/esm/icons/list-checks.js";
export { default as ListOrdered } from "lucide-react/dist/esm/icons/list-ordered.js";
export { default as Loader2 } from "lucide-react/dist/esm/icons/loader-2.js";
export { default as Loader2Icon } from "lucide-react/dist/esm/icons/loader-2.js";
export { default as Lock } from "lucide-react/dist/esm/icons/lock.js";
export { default as LogIn } from "lucide-react/dist/esm/icons/log-in.js";
export { default as LogOut } from "lucide-react/dist/esm/icons/log-out.js";
export { default as Mail } from "lucide-react/dist/esm/icons/mail.js";
export { default as Map } from "lucide-react/dist/esm/icons/map.js";
export { default as MapPin } from "lucide-react/dist/esm/icons/map-pin.js";
export { default as Megaphone } from "lucide-react/dist/esm/icons/megaphone.js";
export { default as Menu } from "lucide-react/dist/esm/icons/menu.js";
export { default as MessageCircleHeart } from "lucide-react/dist/esm/icons/message-circle-heart.js";
export { default as MessageSquare } from "lucide-react/dist/esm/icons/message-square.js";
export { default as MessageSquareText } from "lucide-react/dist/esm/icons/message-square-text.js";
export { default as MessageSquareWarning } from "lucide-react/dist/esm/icons/message-square-warning.js";
export { default as Mic } from "lucide-react/dist/esm/icons/mic.js";
export { default as MinusIcon } from "lucide-react/dist/esm/icons/minus.js";
export { default as MonitorPlay } from "lucide-react/dist/esm/icons/monitor-play.js";
export { default as MoreHorizontal } from "lucide-react/dist/esm/icons/more-horizontal.js";
export { default as MoreHorizontalIcon } from "lucide-react/dist/esm/icons/more-horizontal.js";
export { default as MousePointer } from "lucide-react/dist/esm/icons/mouse-pointer.js";
export { default as OctagonXIcon } from "lucide-react/dist/esm/icons/octagon-x.js";
export { default as Palette } from "lucide-react/dist/esm/icons/palette.js";
export { default as PanelLeftIcon } from "lucide-react/dist/esm/icons/panel-left.js";
export { default as Paperclip } from "lucide-react/dist/esm/icons/paperclip.js";
export { default as Pause } from "lucide-react/dist/esm/icons/pause.js";
export { default as PenSquare } from "lucide-react/dist/esm/icons/pen-square.js";
export { default as Pencil } from "lucide-react/dist/esm/icons/pencil.js";
export { default as Percent } from "lucide-react/dist/esm/icons/percent.js";
export { default as Phone } from "lucide-react/dist/esm/icons/phone.js";
export { default as Pin } from "lucide-react/dist/esm/icons/pin.js";
export { default as Play } from "lucide-react/dist/esm/icons/play.js";
export { default as PlayCircle } from "lucide-react/dist/esm/icons/play-circle.js";
export { default as Plus } from "lucide-react/dist/esm/icons/plus.js";
export { default as Quote } from "lucide-react/dist/esm/icons/quote.js";
export { default as RefreshCw } from "lucide-react/dist/esm/icons/refresh-cw.js";
export { default as Reply } from "lucide-react/dist/esm/icons/reply.js";
export { default as Rocket } from "lucide-react/dist/esm/icons/rocket.js";
export { default as RotateCcw } from "lucide-react/dist/esm/icons/rotate-ccw.js";
export { default as Save } from "lucide-react/dist/esm/icons/save.js";
export { default as ScrollText } from "lucide-react/dist/esm/icons/scroll-text.js";
export { default as Search } from "lucide-react/dist/esm/icons/search.js";
export { default as SearchIcon } from "lucide-react/dist/esm/icons/search.js";
export { default as Send } from "lucide-react/dist/esm/icons/send.js";
export { default as Settings } from "lucide-react/dist/esm/icons/settings.js";
export { default as ShieldAlert } from "lucide-react/dist/esm/icons/shield-alert.js";
export { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";
export { default as SlidersHorizontal } from "lucide-react/dist/esm/icons/sliders-horizontal.js";
export { default as Sparkles } from "lucide-react/dist/esm/icons/sparkles.js";
export { default as Square } from "lucide-react/dist/esm/icons/square.js";
export { default as SquarePen } from "lucide-react/dist/esm/icons/square-pen.js";
export { default as Star } from "lucide-react/dist/esm/icons/star.js";
export { default as StickyNote } from "lucide-react/dist/esm/icons/sticky-note.js";
export { default as Target } from "lucide-react/dist/esm/icons/target.js";
export { default as ToggleLeft } from "lucide-react/dist/esm/icons/toggle-left.js";
export { default as ToggleRight } from "lucide-react/dist/esm/icons/toggle-right.js";
export { default as Trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
export { default as TriangleAlert } from "lucide-react/dist/esm/icons/triangle-alert.js";
export { default as TriangleAlertIcon } from "lucide-react/dist/esm/icons/triangle-alert.js";
export { default as Trophy } from "lucide-react/dist/esm/icons/trophy.js";
export { default as UploadCloud } from "lucide-react/dist/esm/icons/upload-cloud.js";
export { default as User } from "lucide-react/dist/esm/icons/user.js";
export { default as UserCheck } from "lucide-react/dist/esm/icons/user-check.js";
export { default as UserCircle } from "lucide-react/dist/esm/icons/user-circle.js";
export { default as UserPlus } from "lucide-react/dist/esm/icons/user-plus.js";
export { default as Users } from "lucide-react/dist/esm/icons/users.js";
export { default as Video } from "lucide-react/dist/esm/icons/video.js";
export { default as Volume2 } from "lucide-react/dist/esm/icons/volume-2.js";
export { default as VolumeX } from "lucide-react/dist/esm/icons/volume-x.js";
export { default as Wand2 } from "lucide-react/dist/esm/icons/wand-2.js";
export { default as Wrench } from "lucide-react/dist/esm/icons/wrench.js";
export { default as X } from "lucide-react/dist/esm/icons/x.js";
export { default as XCircle } from "lucide-react/dist/esm/icons/x-circle.js";
export { default as XIcon } from "lucide-react/dist/esm/icons/x.js";
