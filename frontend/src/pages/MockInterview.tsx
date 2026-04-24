import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Calendar, User, MessageSquare, Bot, Briefcase, BrainCircuit, Sparkles, Trophy, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const MockInterview = () => {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = (user.role || 'student').toLowerCase() as any;
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', mode: 'TECHNICAL', facultyId: '' });

  useEffect(() => {
    fetchInterviews();
    fetchProfile();
    if (userRole === 'faculty') fetchStudents();
    else fetchFaculties();
  }, [userRole]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      setCurrentUser(response.data.data.user);
      if (response.data.data.user?.mentorId) {
        setScheduleData(prev => ({ ...prev, facultyId: response.data.data.user.mentorId }));
      }
    } catch (error) { console.error("Failed to fetch profile", error); }
  };

  const fetchFaculties = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/faculty`, { headers: { Authorization: `Bearer ${token}` } });
      setFaculties(response.data.data || []);
    } catch (error) { console.error("Failed to fetch faculties", error); }
  };

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/interviews/user`, { headers: { Authorization: `Bearer ${token}` } });
      setInterviews(response.data.data || []);
    } catch (error) { console.error("Failed to fetch interviews", error); }
    finally { setLoading(false); }
  };

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE}/faculty/students`, { headers: { Authorization: `Bearer ${token}` } });
      setStudents(response.data.data || []);
    } catch (error) { console.error("Failed to fetch students", error); }
  };

  const handleSchedule = async (isImmediate = false) => {
    try {
      const token = localStorage.getItem('accessToken');
      const scheduledAt = isImmediate ? new Date() : new Date(`${scheduleData.date}T${scheduleData.time}`);
      const payload = {
        title: `Mock Interview (${scheduleData.mode})`, type: 'FACULTY', mode: scheduleData.mode,
        studentId: userRole === 'faculty' ? selectedStudent?.id : user.id,
        facultyId: userRole === 'faculty' ? user.id : scheduleData.facultyId,
        scheduledAt, isImmediate
      };
      const response = await axios.post(`${API_BASE}/interviews/start`, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (isImmediate) {
        toast({ title: "Starting Session", description: "Entering the interview room now." });
        navigate(`/${userRole}/interview/${response.data.data.id}`);
      } else {
        toast({ title: "Success", description: "Interview scheduled successfully." });
        setIsScheduleOpen(false);
        fetchInterviews();
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to process request." });
    }
  };

  const startInterview = async (studentId: string, studentName: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(`${API_BASE}/interviews/start`,
        { title: `Mock Interview with ${studentName}`, type: 'FACULTY', mode: 'TECHNICAL', facultyId: user.id, studentId, isImmediate: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/faculty/interview/${response.data.data.id}`);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to start interview." });
    }
  };

  const startAIInterview = async (mode: 'TECHNICAL' | 'HR') => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(`${API_BASE}/interviews/start`,
        { title: `AI Mock Interview - ${mode}`, type: 'AI', mode, isImmediate: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/student/interview/${response.data.data.id}`);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to start AI interview." });
    }
  };

  if (loading) return (
    <DashboardLayout role={userRole}>
      <div className="flex items-center justify-center h-[70vh] text-muted-foreground">Loading...</div>
    </DashboardLayout>
  );

  const interviewCards = [
    {
      icon: BrainCircuit, label: "AI Technical", title: "Technical Drill",
      subtitle: "AI-Powered Engineering Evaluation",
      features: ["Deep technical follow-ups", "Code logic evaluation", "Sentiment & clarity tracking"],
      action: () => startAIInterview('TECHNICAL'), actionLabel: "Launch Drill", outline: false,
    },
    {
      icon: Sparkles, label: "AI HR", title: "HR & Behavior",
      subtitle: "Soft Skills & Culture Fit",
      features: ["Communication flow analysis", "Confidence score metrics", "STAR method validation"],
      action: () => startAIInterview('HR'), actionLabel: "Launch HR", outline: false,
    },
    {
      icon: User, label: "Faculty", title: "Mentor Session",
      subtitle: "Human 1-on-1 Interview",
      features: ["Personalized feedback", "Industry specific tips", "Resume review support"],
      action: () => setIsScheduleOpen(true), actionLabel: "Book Session", outline: true,
    },
  ];

  return (
    <DashboardLayout role={userRole}>
      <div className="space-y-10 animate-in fade-in duration-500">

        {/* Page Header */}
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-medium mb-1">
            {userRole === 'faculty' ? 'Faculty Portal' : 'Practice Center'}
          </p>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            {userRole === 'faculty' ? 'Interview Management' : 'Mock Interviews'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {userRole === 'faculty'
              ? 'Conduct and schedule interviews with your assigned students.'
              : 'Practice with AI or book a session with your faculty mentor.'}
          </p>
        </div>

        {/* Student Interview Cards */}
        {userRole === 'student' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {interviewCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="h-full"
              >
                <div className="glass-card rounded-2xl p-6 shadow-elevated h-full flex flex-col group hover:scale-[1.02] transition-transform duration-300">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                      <card.icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-xs uppercase tracking-widest font-medium text-primary">{card.label}</p>
                  </div>
                  <h2 className="text-xl font-display font-bold mb-1">{card.title}</h2>
                  <p className="text-sm text-muted-foreground mb-5">{card.subtitle}</p>
                  <ul className="space-y-2.5 flex-1 mb-6">
                    {card.features.map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={card.outline ? "outline" : "default"}
                    className={`w-full font-semibold ${card.outline ? 'border-primary/30 text-primary hover:bg-primary/5' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                    onClick={card.action}
                  >
                    <Play className="mr-2 h-4 w-4" /> {card.actionLabel}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue={userRole === 'faculty' ? 'students' : 'upcoming'} className="w-full">
          <TabsList className="mb-6 p-1 bg-muted/50 rounded-xl">
            {userRole === 'faculty' && <TabsTrigger value="students" className="rounded-lg px-8">My Students</TabsTrigger>}
            <TabsTrigger value="upcoming" className="rounded-lg px-8">Active & Scheduled</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg px-8">Session History</TabsTrigger>
          </TabsList>

          {userRole === 'faculty' && (
            <TabsContent value="students" className="space-y-3">
              {students.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl text-muted-foreground">
                  <User className="h-10 w-10 mb-3 opacity-30" />
                  <p className="font-medium">No students assigned yet</p>
                </div>
              )}
              {students.map((student) => (
                <div key={student.id} className="glass-card rounded-2xl p-5 shadow-elevated flex items-center justify-between hover:scale-[1.01] transition-transform duration-200">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {student.name?.[0] || 'S'}
                    </div>
                    <div>
                      <h3 className="font-semibold">{student.name}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">{student.roll} · {student.branch}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end mr-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Readiness</p>
                      <p className="text-primary font-bold">{student.readiness}%</p>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-lg border-primary/20 text-primary hover:bg-primary/5"
                      onClick={() => { setSelectedStudent(student); setIsScheduleOpen(true); }}>
                      <Calendar className="mr-1.5 h-3.5 w-3.5" /> Schedule
                    </Button>
                    <Button size="sm" className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => startInterview(student.id, student.name)}>
                      Join Now
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>
          )}

          <TabsContent value="upcoming" className="space-y-3">
            {interviews.filter(i => i.status !== 'COMPLETED' && i.type === 'FACULTY').length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">No scheduled sessions</p>
                <p className="text-sm mt-1 opacity-60">Book a faculty session above to see it listed here.</p>
              </div>
            ) : interviews.filter(i => i.status !== 'COMPLETED' && i.type === 'FACULTY').map((interview) => (
              <div key={interview.id} className="glass-card rounded-2xl p-5 shadow-elevated flex items-center justify-between hover:scale-[1.01] transition-transform duration-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    {interview.type === 'AI' ? <Bot className="h-6 w-6" /> : <User className="h-6 w-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{interview.title}</h3>
                      <Badge variant={interview.status === 'IN_PROGRESS' ? 'default' : 'outline'} className="text-[10px] uppercase tracking-widest rounded-full px-2">
                        {interview.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {interview.mode}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />
                        {new Date(interview.scheduledAt || interview.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </p>
                  </div>
                </div>
                <Button className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  onClick={() => navigate(`/${userRole}/interview/${interview.id}`)}>
                  {interview.status === 'IN_PROGRESS' ? 'Rejoin' : 'Join Session'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {interviews.filter(i => i.status === 'COMPLETED').length === 0 ? (
              <div className="p-20 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
                No completed interviews yet. Finish a session to see your analysis.
              </div>
            ) : interviews.filter(i => i.status === 'COMPLETED').map((interview) => (
              <div key={interview.id} className="glass-card rounded-2xl p-5 shadow-elevated flex items-center justify-between hover:scale-[1.01] transition-transform duration-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted text-muted-foreground">
                    {interview.type === 'AI' ? <Bot className="h-6 w-6" /> : <User className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{interview.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(interview.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1 text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                        <Trophy className="h-3 w-3" /> {Math.round(interview.overallScore)}%
                      </span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-medium"
                  onClick={() => navigate(`/${userRole}/interview/${interview.id}`)}>
                  View Report <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {/* Schedule Dialog */}
        <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
          <DialogContent className="sm:max-w-[420px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display font-bold">
                {userRole === 'faculty' ? 'Schedule Interview' : 'Book Faculty Session'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {userRole === 'faculty' ? `Plan a session for ${selectedStudent?.name}` : 'Select a mentor and preferred time.'}
              </p>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              {userRole === 'student' && (
                <div className="grid gap-2">
                  <Label className="text-xs uppercase tracking-widest font-medium text-muted-foreground">Select Faculty</Label>
                  <Select value={scheduleData.facultyId} onValueChange={(v) => setScheduleData({ ...scheduleData, facultyId: v })}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Choose a mentor" /></SelectTrigger>
                    <SelectContent>
                      {faculties.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          <div className="flex items-center justify-between w-full gap-2">
                            <span>{f.name || f.fullName} ({f.department || 'Expert'})</span>
                            {f.id === currentUser?.mentorId && (
                              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">Assigned</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs uppercase tracking-widest font-medium text-muted-foreground">Date</Label>
                  <Input type="date" className="rounded-xl h-11" value={scheduleData.date} onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs uppercase tracking-widest font-medium text-muted-foreground">Time</Label>
                  <Input type="time" className="rounded-xl h-11" value={scheduleData.time} onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-widest font-medium text-muted-foreground">Interview Mode</Label>
                <Select value={scheduleData.mode} onValueChange={(v) => setScheduleData({ ...scheduleData, mode: v })}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TECHNICAL">Technical Round</SelectItem>
                    <SelectItem value="HR">HR / Behavioral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => handleSchedule(false)}
                disabled={!scheduleData.date || !scheduleData.time || (userRole === 'student' && !scheduleData.facultyId)}>
                Schedule for Later
              </Button>
              <Button className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                onClick={() => handleSchedule(true)} disabled={userRole === 'student' && !scheduleData.facultyId}>
                <Play className="mr-2 h-4 w-4" /> Start Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default MockInterview;
