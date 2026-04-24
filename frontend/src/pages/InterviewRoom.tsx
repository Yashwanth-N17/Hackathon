import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Mic, MicOff, Video, VideoOff, X, Bot, User, Loader2, CheckCircle2, AlertCircle, BarChart3, MessageSquare, ArrowLeft, Play, Trophy, Sparkles, BrainCircuit, ClipboardList, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';
import * as faceapi from '@vladmandic/face-api';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

const InterviewRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [interview, setInterview] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [liveCaptions, setLiveCaptions] = useState({ me: "", partner: "" });
  const [sentiment, setSentiment] = useState({ label: "Neutral", score: 50, clarity: 80 });
  const [currentEmotion, setCurrentEmotion] = useState("neutral");

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const socketRef = useRef<any>(null);
  const isMutedRef = useRef(isMuted);
  const isTypingRef = useRef(isTyping);
  const inputRef = useRef(input);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  const behavioralDataRef = useRef({ happy: 0, neutral: 0, sad: 0, fearful: 0, angry: 0, surprised: 0, total: 0 });
  const faceApiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendMessageRef = useRef<any>(null);

  // Callback ref so video always gets the stream immediately on mount
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && localStreamRef.current) {
      if (node.srcObject !== localStreamRef.current) {
        node.srcObject = localStreamRef.current;
        node.play().catch(() => {});
      }
    }
  };

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isTypingRef.current = isTyping; }, [isTyping]);
  useEffect(() => { inputRef.current = input; }, [input]);

  const mediaInitialized = useRef(false);
  useEffect(() => {
    if (mediaInitialized.current) return;
    mediaInitialized.current = true;

    fetchInterview();
    startMedia();
    const newSocket = io(SOCKET_URL);
    socketRef.current = newSocket;
    setSocket(newSocket);
    newSocket.emit("join_interview", id);
    newSocket.on("receive_message", (message: any) => {
      setMessages(prev => [...prev, message]);
      setIsTyping(false);
      if (message.senderRole === 'AI' || message.senderRole === 'FACULTY') speakText(message.text);
    });
    newSocket.on("receive_live_transcript", ({ text, senderId }: any) => {
      if (senderId !== user.id) {
        setLiveCaptions(prev => ({ ...prev, partner: text }));
        setTimeout(() => setLiveCaptions(prev => prev.partner === text ? { ...prev, partner: "" } : prev), 3000);
      }
    });
    newSocket.on("interview_ended", () => { fetchInterview(); toast({ title: "Interview Ended" }); });
    return () => {
      newSocket.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if (recognitionRef.current) recognitionRef.current.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [id]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
      } catch (e) {
        console.error('Failed to load Face API models', e);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!localStream || isVideoOff) return;
    
    faceApiIntervalRef.current = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        try {
          const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
          if (detections) {
            const expressions = detections.expressions;
            let maxEmotion = 'neutral';
            let maxValue = 0;
            Object.entries(expressions).forEach(([emotion, value]) => {
              if (value > maxValue) { maxValue = value as number; maxEmotion = emotion; }
            });
            setCurrentEmotion(maxEmotion);
            const bRef = behavioralDataRef.current;
            bRef.total += 1;
            if (maxEmotion in bRef) (bRef as any)[maxEmotion] += 1;
          }
        } catch (e) {}
      }
    }, 1000);
    
    return () => { if (faceApiIntervalRef.current) clearInterval(faceApiIntervalRef.current); };
  }, [localStream, isVideoOff]);


  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!interview || !localStream) return;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    
    let lastUpdateTime = 0;
    rec.onresult = (event: any) => {
      if (isMutedRef.current) return;
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      
      const now = Date.now();
      if (!final && now - lastUpdateTime < 150) return;
      lastUpdateTime = now;

      const text = interim || final;
      setLiveCaptions(prev => ({ ...prev, me: text }));
      if (text) {
        const positiveWords = ['great', 'good', 'confident', 'achieved', 'solved', 'efficient', 'happy', 'excellent'];
        const negativeWords = ['difficult', 'hard', 'failed', 'unsure', 'problem', 'stuck', 'confused'];
        let score = 50;
        text.toLowerCase().split(' ').forEach(w => {
          if (positiveWords.includes(w)) score += 8;
          if (negativeWords.includes(w)) score -= 8;
        });
        score = Math.max(0, Math.min(100, score));
        setSentiment({ label: score > 70 ? 'Positive' : score < 40 ? 'Concerned' : 'Neutral', score, clarity: 75 + Math.random() * 20 });
      }
      if (interview.type === 'FACULTY' && socketRef.current) {
        socketRef.current.emit("send_live_transcript", { interviewId: id, text, senderId: user.id });
      }
      if (interview.type === 'AI') {
        setInput(text);
        if (autoSendTimeoutRef.current) clearTimeout(autoSendTimeoutRef.current);
        if (text.trim() && final) {
          autoSendTimeoutRef.current = setTimeout(() => {
            if (sendMessageRef.current) sendMessageRef.current(text);
          }, 1500);
        }
      }
      if (final) {
        setTimeout(() => {
          setLiveCaptions(prev => prev.me === text ? { ...prev, me: '' } : prev);
        }, 3000);
      }
    };
    
    let allowRestart = true;
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        allowRestart = false;
      }
    };
    
    rec.onspeechstart = () => { setIsSpeaking(true); };
    rec.onspeechend = () => { setIsSpeaking(false); };
    rec.onend = () => { if (!isMutedRef.current && allowRestart) try { rec.start(); } catch (e) {} };
    try { rec.start(); } catch (e) {}
    recognitionRef.current = rec;
    return () => { 
      allowRestart = false;
      recognitionRef.current = null; 
      try { rec.stop(); } catch (e) {} 
    };
  }, [interview?.id, localStream]);


  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const checkAudioLevel = () => {
        if (!analyserRef.current || isMutedRef.current) {
          setIsSpeaking(false);
          setAudioLevel(0);
        } else {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
          const average = sum / bufferLength;
          const level = Math.min(100, (average / 128) * 100);
          setAudioLevel(level);
          setIsSpeaking(level > 5);
        }
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };
      checkAudioLevel();
      
      toast({ title: "✅ Media Connected", description: "Camera and microphone are ready." });
    } catch (err: any) {
      let errorDescription = "Could not access camera or microphone.";
      if (err.name === 'NotAllowedError') errorDescription = "Permission denied. Please allow access in browser settings.";
      else if (err.name === 'NotReadableError') errorDescription = "Camera or microphone is already in use by another app.";
      else if (err.name === 'NotFoundError') errorDescription = "No camera or microphone found.";
      toast({ variant: "destructive", title: "Media Error", description: errorDescription, duration: 5000 });
    }
  };

  const toggleMic = () => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      requestAnimationFrame(() => localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; }));
      toast({ title: next ? "Microphone Muted" : "Microphone Active" });
      return next;
    });
  };

  const toggleVideo = () => {
    setIsVideoOff(prev => {
      const next = !prev;
      requestAnimationFrame(() => localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next; }));
      toast({ title: next ? "Camera Disabled" : "Camera Active" });
      return next;
    });
  };

  const speakText = (text: string) => window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));

  const fetchInterview = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) { navigate('/login'); return; }
      const res = await axios.get(`${API_BASE}/interviews/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.data.data || res.data;
      setInterview(data);
      setMessages(data.messages || []);
    } catch (error: any) {
      if (error.response?.status === 401) { localStorage.removeItem('accessToken'); navigate('/login'); }
      else toast({ variant: "destructive", title: "Error", description: "Could not load interview session." });
    } finally { setLoading(false); }
  };

  const sendMessage = async (textToSend?: string | any) => {
    const finalInput = typeof textToSend === 'string' ? textToSend : input;
    if (!finalInput.trim() || !socket) return;
    
    if (autoSendTimeoutRef.current) clearTimeout(autoSendTimeoutRef.current);
    
    const messageData = { interviewId: id, senderRole: user.role, senderName: user.name || user.fullName || "Student", text: finalInput };
    if (interview.type === 'AI') {
      setIsTyping(true);
      try {
        const token = localStorage.getItem('accessToken');
        setMessages(prev => [...prev, { ...messageData, createdAt: new Date() }]);
        setInput("");
        const res = await axios.post(`${API_BASE}/interviews/ai-respond`, { interviewId: id, text: finalInput }, { headers: { Authorization: `Bearer ${token}` } });
        setMessages(res.data.data?.messages || res.data.messages || []);
      } catch { toast({ variant: "destructive", title: "AI Error", description: "AI failed to respond." }); }
      finally { setIsTyping(false); }
    } else { socket.emit("send_message", messageData); setInput(""); }
  };

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const finishInterview = async () => {
    setAnalyzing(true);
    try {
      const token = localStorage.getItem('accessToken');
      const bRef = behavioralDataRef.current;
      const total = bRef.total || 1;
      const behavioralData = {
        happy: Math.round((bRef.happy / total) * 100),
        neutral: Math.round((bRef.neutral / total) * 100),
        stressed: Math.round(((bRef.sad + bRef.fearful + bRef.angry) / total) * 100),
        surprised: Math.round((bRef.surprised / total) * 100)
      };

      await axios.post(`${API_BASE}/interviews/${id}/finish`, { behavioralData }, { headers: { Authorization: `Bearer ${token}` } });
      
      toast({ 
        title: "Interview Completed! 🚀", 
        description: "Your session has been analyzed. View your results below." 
      });
      
      // Refresh to show the COMPLETED view
      await fetchInterview();
    } catch (error) { 
      console.error("Finish Interview Error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to submit interview." }); 
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return (
    <DashboardLayout role={(user.role?.toLowerCase() || "student") as any}>
      <div className="flex items-center justify-center h-[70vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
    </DashboardLayout>
  );

  // ─── Completed Report View ───────────────────────────────────────────────────
  if (interview?.status === 'COMPLETED') {
    const stats = [
      { label: "Technical", val: interview.analysis?.technical || 0, icon: BrainCircuit },
      { label: "Soft Skills", val: interview.analysis?.communication || 0, icon: MessageSquare },
      { label: "Confidence", val: interview.analysis?.confidence || 0, icon: Sparkles },
      { label: "Logic", val: interview.analysis?.problemSolving || 0, icon: TrendingUp },
    ];
    return (
      <DashboardLayout role={(user.role?.toLowerCase() || "student") as any}>
        <div className="space-y-8 animate-in fade-in duration-500">

          {/* Page Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-primary font-medium mb-1">Session Complete</p>
              <h1 className="text-3xl font-display font-bold tracking-tight">{interview.title}</h1>
              <p className="text-muted-foreground mt-1 text-sm">Placement Readiness Intelligence Report · {new Date(interview.createdAt).toLocaleDateString()}</p>
            </div>
            <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5" onClick={() => navigate('/student/interview')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>

          {/* Score banner */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="glass-card rounded-2xl p-6 shadow-elevated flex flex-col sm:flex-row items-center gap-6">
            <div className="rounded-2xl bg-primary/10 p-4">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Overall Readiness Score</p>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-display font-bold text-primary">{Math.round(interview.overallScore)}</span>
                <span className="text-xl text-muted-foreground mb-1">/ 100</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${interview.overallScore}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 min-w-[260px]">
              {stats.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
                  className="glass-card rounded-xl p-3 shadow-elevated">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <s.icon className="h-3 w-3" />
                    <span className="text-[9px] uppercase tracking-widest font-medium">{s.label}</span>
                  </div>
                  <p className="text-xl font-display font-bold text-primary">{s.val}%</p>
                  <div className="h-1 w-full bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${s.val}%` }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Feedback */}
            <div className="lg:col-span-2 space-y-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="glass-card rounded-2xl p-6 shadow-elevated space-y-2">
                <h2 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Deep Analysis & Prep Instructions
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {interview.feedback || "AI is synthesizing your deep report and instructions based on the interview..."}
                </p>
              </motion.div>
            </div>

            {/* Transcript */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl shadow-elevated flex flex-col" style={{ maxHeight: 480 }}>
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Session Transcript
                </h2>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((m, idx) => {
                    const isMe = m.senderRole === (user.role?.toUpperCase() || 'STUDENT');
                    return (
                      <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-muted-foreground mb-1 px-1">{m.senderName}</span>
                        <div className={`p-3 rounded-xl max-w-[90%] text-sm leading-relaxed ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border text-center">
                <p className="text-[10px] text-muted-foreground italic">Generated by PlaceReady NLP Engine</p>
              </div>
            </motion.div>
          </div>

        </div>
      </DashboardLayout>
    );
  }

  // ─── Active Interview View ────────────────────────────────────────────────────
  return (
    <DashboardLayout role={(user.role?.toLowerCase() || "student") as any}>
      <div className="h-[calc(100vh-140px)] flex flex-col gap-4 max-w-7xl mx-auto animate-in fade-in duration-500">

        {/* Header */}
        <div className="glass-card rounded-2xl px-5 py-4 shadow-elevated flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-primary/10 p-2.5">
              {interview?.type === 'AI' ? <Bot className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">{interview?.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest rounded-full px-2 border-primary/20 text-primary">{interview?.mode}</Badge>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  LIVE · {id?.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" className="rounded-xl border-red-500/30 text-red-500 hover:bg-red-500/5 font-medium" onClick={finishInterview} disabled={analyzing}>
            {analyzing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <X className="h-4 w-4 mr-2" />} End Session
          </Button>
        </div>

        {/* Main layout */}
        <div className="flex-1 overflow-hidden flex gap-4 min-h-0">

          {/* Chat panel */}
          <div className="flex-1 glass-card rounded-2xl shadow-elevated flex flex-col overflow-hidden relative">
            {/* Mic Speaking Indicator */}
            {(isSpeaking || liveCaptions.me || liveCaptions.partner) && (
              <div className="absolute bottom-20 left-0 right-0 z-10 pointer-events-none flex flex-col items-center gap-2 px-8">
                {isSpeaking && (
                  <div className="flex items-center gap-3 bg-background/90 backdrop-blur-md border border-primary/30 rounded-2xl px-4 py-2.5 shadow-lg overflow-hidden relative">
                    <div className="absolute inset-0 bg-primary/20 mix-blend-screen" style={{ opacity: audioLevel / 100 }} />
                    <div className="flex items-center gap-[3px] h-5 relative z-10">
                      {[0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.7].map((baseHeight, i) => {
                        const dynamicHeight = Math.max(15, (audioLevel * baseHeight));
                        return (
                          <div
                            key={i}
                            className="w-[3px] bg-primary rounded-full transition-all duration-75 ease-out"
                            style={{ height: `${dynamicHeight}%` }}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs text-primary font-medium relative z-10">Listening…</span>
                  </div>
                )}
                {liveCaptions.me && (
                  <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-xl text-sm max-w-[80%] text-center">
                    <span className="font-medium mr-1">You:</span>{liveCaptions.me}
                  </div>
                )}
                {liveCaptions.partner && (
                  <div className="bg-background/80 backdrop-blur-sm text-foreground border border-border px-4 py-1.5 rounded-xl text-sm max-w-[80%] text-center">
                    <span className="text-primary font-medium mr-1">Partner:</span>{liveCaptions.partner}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[350px] text-center space-y-4">
                    <div className="rounded-2xl bg-primary/10 p-5">
                      <Bot className="h-12 w-12 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-xl">Session Ready</h3>
                      <p className="text-muted-foreground text-sm mt-1">Type or speak to begin your interview</p>
                    </div>
                  </motion.div>
                )}
                {messages.map((m, idx) => {
                  const isMe = m.senderRole === (user.role?.toUpperCase() || 'STUDENT');
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 mb-1.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <div className={`p-1 rounded-lg ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {m.senderRole === 'AI' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{m.senderName}</span>
                      </div>
                      <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                        {m.text}
                      </div>
                    </motion.div>
                  );
                })}
                {isTyping && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-2xl w-fit">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">AI is thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-3 max-w-3xl mx-auto">
                <Input value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your response..." disabled={isTyping}
                  className="h-12 rounded-xl flex-1 bg-background border-border focus-visible:ring-primary" />
                <Button type="submit" size="icon" className="rounded-xl h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0" disabled={!input.trim() || isTyping}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* ─── Right panel ──────────────────────────────────────────────── */}
          {/* FIX: removed min-h-0 overflow-hidden so the NLP panel is never clipped */}
          <div className="w-72 hidden lg:flex flex-col gap-4 overflow-y-auto">

            {/* Camera preview */}
            <div className="glass-card rounded-2xl shadow-elevated overflow-hidden flex-shrink-0">
              <div className="relative w-full aspect-video bg-muted">
                <video
                  ref={setVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ display: isVideoOff ? 'none' : 'block' }}
                />
                {isVideoOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <VideoOff className="h-8 w-8" />
                    <span className="text-xs">Camera Off</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2">
                  <span className="bg-background/70 backdrop-blur-sm text-xs px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                    {user.name || 'You'}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── FIX: Icon-only mic / video controls ─── */}
            <div className="glass-card rounded-2xl shadow-elevated px-5 py-4 flex-shrink-0">
              <h3 className="text-xs uppercase tracking-widest font-medium text-muted-foreground flex items-center gap-2 mb-4">
                <Play className="h-3.5 w-3.5 text-primary" /> Session Controls
              </h3>
              <div className="flex items-center justify-center gap-3">
                {/* Mic toggle */}
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-xl"
                  onClick={toggleMic}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                {/* Camera toggle */}
                <Button
                  variant={isVideoOff ? "destructive" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-xl"
                  onClick={toggleVideo}
                  title={isVideoOff ? "Enable Camera" : "Disable Camera"}
                >
                  {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            {/* ─── FIX: NLP Intelligence — no flex-1/min-h-0 clipping ─── */}
            <div className="glass-card rounded-2xl shadow-elevated p-5 flex-shrink-0 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> NLP Intelligence
                </h3>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] rounded-full px-2 animate-pulse">LIVE</Badge>
              </div>

              {/* Performance */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Performance</span>
                  <span className="font-medium text-foreground">{sentiment.label}</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${sentiment.score}%` }} />
                </div>
              </div>

              {/* Speech clarity */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Speech Clarity</span>
                  <span className="font-medium text-foreground">{Math.round(sentiment.clarity)}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full transition-all duration-1000" style={{ width: `${sentiment.clarity}%` }} />
                </div>
              </div>

              {/* Visual expression */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Visual Expression</span>
                  <span className="font-medium text-foreground capitalize">{currentEmotion}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div className={`h-1.5 flex-1 rounded-full ${currentEmotion === 'happy' ? 'bg-green-500' : 'bg-muted'}`} />
                  <div className={`h-1.5 flex-1 rounded-full ${currentEmotion === 'neutral' ? 'bg-blue-500' : 'bg-muted'}`} />
                  <div className={`h-1.5 flex-1 rounded-full ${(currentEmotion === 'sad' || currentEmotion === 'fearful' || currentEmotion === 'angry') ? 'bg-red-500' : 'bg-muted'}`} />
                </div>
              </div>

              {/* Coaching hint */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground leading-relaxed italic">
                {sentiment.score > 70
                  ? "Great confidence! Keep maintaining this tone."
                  : sentiment.score < 40
                  ? "Take a breath and focus on key points."
                  : "Steady pace. Try to add more enthusiasm."}
              </div>

              {/* Live status */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                Monitoring transcript...
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InterviewRoom;