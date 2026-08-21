/**
 * @fileoverview Telegram Booking Bot Page
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchTelegramBotUsername } from '@/api/telegramBot';
import { bootstrapTelegramBotConfig, getEnvBotUsername } from '@/lib/telegramBotConfig';
import { useAuth } from '@/lib/AuthContext';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Bot, MessageSquare, Calendar, Settings, Send, TrendingUp, CheckCircle, XCircle,
  RefreshCw, Copy, ExternalLink, Clock, User, Eye, Play, Pause, Save, Smartphone
} from 'lucide-react';

const DEFAULT_COMMANDS = [
  {
    command: '/start',
    description: 'Botni ishga tushirish',
    response: 'Assalomu alaykum! Dental Pro Clinic online navbat olish botiga xush kelibsiz.',
    isActive: true
  },
  {
    command: '/book',
    description: 'Navbat olish',
    response: 'Xizmat turini tanlang:',
    isActive: true
  },
  {
    command: '/services',
    description: 'Xizmatlar royxati',
    response: 'Bizning xizmatlarimiz: Tish davolash, Tish olish, Professional tozalash, Protezlash, Implantatsiya',
    isActive: true
  },
  {
    command: '/mybookings',
    description: 'Mening navbatlarim',
    response: 'Sizning navbatlaringiz:',
    isActive: true
  },
  {
    command: '/cancel',
    description: 'Navbatni bekor qilish',
    response: 'Bekor qilmoqchi bolgan navbatingizni tanlang:',
    isActive: true
  },
  {
    command: '/contact',
    description: 'Aloqa malumotlari',
    response: 'Manzil: Toshkent sh., Mustaqillik kochasi 15. Telefon: +998 71 123 45 67. Ish vaqti: Du-Sha 09:00-18:00',
    isActive: true
  },
  {
    command: '/help',
    description: 'Yordam',
    response: 'Botdan foydalanish: /book - Navbat olish, /services - Xizmatlar, /mybookings - Mening navbatlarim',
    isActive: true
  }
];

const DEFAULT_SERVICES = [
  'Tish davolash',
  'Tish olish',
  'Professional tozalash',
  'Protezlash',
  'Implantatsiya',
  'Konsultatsiya',
  'Rentgen',
  'Oqartirish'
];

const DEFAULT_WORKING_HOURS = {
  monday: { start: '09:00', end: '18:00', isOpen: true },
  tuesday: { start: '09:00', end: '18:00', isOpen: true },
  wednesday: { start: '09:00', end: '18:00', isOpen: true },
  thursday: { start: '09:00', end: '18:00', isOpen: true },
  friday: { start: '09:00', end: '18:00', isOpen: true },
  saturday: { start: '09:00', end: '15:00', isOpen: true },
  sunday: { start: '09:00', end: '15:00', isOpen: false }
};

export default function TelegramBot() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  bootstrapTelegramBotConfig();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState({
    botToken: '',
    botUsername: '',
    isActive: false,
    welcomeMessage: 'Assalomu alaykum! Dental Pro Clinic botiga xush kelibsiz.',
    availableServices: DEFAULT_SERVICES,
    workingHours: DEFAULT_WORKING_HOURS,
    bookingAdvanceDays: 14,
    slotDuration: 30,
    requirePhone: true,
    allowSameDay: false,
    leadChatId: ''
  });
  const [commands, setCommands] = useState(DEFAULT_COMMANDS);
  const [editingCommand, setEditingCommand] = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  const [testMessage, setTestMessage] = useState('');
  const [testChatId, setTestChatId] = useState('');

  const { data: botConfig } = useQuery({
    queryKey: ['botConfig'],
    queryFn: async () => {
      const response = await base44.get('/BotConfig');
      return response.data?.[0] || null;
    }
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['telegramBookings'],
    queryFn: async () => {
      const response = await base44.get('/TelegramBooking', { params: { sort: '-createdAt' } });
      return response.data || [];
    }
  });

  const saveConfig = useMutation({
    mutationFn: async (data) => {
      const endpoint = botConfig ? `/BotConfig/${botConfig.id}` : '/BotConfig';
      const method = botConfig ? 'patch' : 'post';
      const response = await base44[method](endpoint, data);
      return response.data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['botConfig'] });
      toast({ title: 'Sozlamalar saqlandi', description: 'Bot konfiguratsiyasi yangilandi' });

      // Global bot: barcha klinikalar uchun bitta bot ishlatilsa,
      // klinika almashtirilganda ham link chiqishi uchun localStorage’ga ham saqlab qo‘yamiz.
      try {
        const globalUsername = (saved?.botUsername || config.botUsername || '').replace('@', '').trim();
        const globalToken = saved?.botToken || config.botToken || '';
        if (globalUsername) localStorage.setItem('global_bot_username', globalUsername);
        if (globalToken) localStorage.setItem('global_bot_token', globalToken);
      } catch {
        // ignore
      }
    },
    onError: (error) => {
      toast({ title: 'Xatolik', description: error.message || 'Sozlamalarni saqlashda xatolik', variant: 'destructive' });
    }
  });

  const toggleBot = useMutation({
    mutationFn: async (isActive) => {
      const response = await base44.patch(`/BotConfig/${botConfig.id}`, { isActive });
      return response.data;
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ['botConfig'] });
      toast({ title: isActive ? 'Bot yoqildi' : 'Bot ochirildi', description: isActive ? 'Telegram bot faollashtirildi' : 'Telegram bot vaqtinchalik ochirildi' });
    }
  });

  const updateBookingStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await base44.patch(`/TelegramBooking/${id}`, { status, confirmedAt: status === 'confirmed' ? new Date().toISOString() : undefined });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegramBookings'] });
      toast({ title: 'Status yangilandi', description: 'Navbat statusi ozgartirildi' });
    }
  });

  const sendTestMessage = useMutation({
    mutationFn: async ({ chatId, message }) => {
      const response = await base44.post('/BotTestMessage', { chatId, message });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Xabar yuborildi', description: 'Test xabar muvaffaqiyatli yuborildi' });
      setTestMessage('');
    },
    onError: (error) => {
      toast({ title: 'Xatolik', description: error.message || 'Xabar yuborishda xatolik', variant: 'destructive' });
    }
  });

  useEffect(() => {
    if (botConfig) {
      setConfig({
        botToken: botConfig.botToken || '',
        botUsername: botConfig.botUsername || getEnvBotUsername() || '',
        isActive: botConfig.isActive || false,
        welcomeMessage: botConfig.welcomeMessage || config.welcomeMessage,
        availableServices: botConfig.availableServices || DEFAULT_SERVICES,
        workingHours: botConfig.workingHours || DEFAULT_WORKING_HOURS,
        bookingAdvanceDays: botConfig.bookingAdvanceDays || 14,
        slotDuration: botConfig.slotDuration || 30,
        requirePhone: botConfig.requirePhone !== false,
        allowSameDay: botConfig.allowSameDay || false,
        leadChatId: botConfig.leadChatId || botConfig.lead_chat_id || ''
      });
      if (botConfig.commands) {
        setCommands(botConfig.commands);
      }

      // Global bot: boshqa klinikaga o‘tganda ham link chiqishi uchun localStorage’da saqlab boramiz.
      try {
        const globalUsername = String(botConfig.botUsername || '').replace('@', '').trim();
        if (globalUsername) localStorage.setItem('global_bot_username', globalUsername);
        if (botConfig.botToken) localStorage.setItem('global_bot_token', botConfig.botToken);
      } catch {
        // ignore
      }
    }
  }, [botConfig]);

  const handleConfigChange = useCallback((field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleWorkingHoursChange = useCallback((day, field, value) => {
    setConfig(prev => ({
      ...prev,
      workingHours: { ...prev.workingHours, [day]: { ...prev.workingHours[day], [field]: value } }
    }));
  }, []);

  const handleServicesChange = useCallback((services) => {
    setConfig(prev => ({ ...prev, availableServices: services.split('\n').filter(s => s.trim()) }));
  }, []);

  const handleSaveConfig = useCallback(async () => {
    if (!config.botToken) {
      toast({ title: 'Xatolik', description: 'Bot tokenini kiriting', variant: 'destructive' });
      return;
    }

    let nextConfig = { ...config };
    if (!String(nextConfig.botUsername || '').replace(/^@/, '').trim()) {
      const username = await fetchTelegramBotUsername(nextConfig.botToken);
      if (!username) {
        toast({
          title: 'Xatolik',
          description: 'Bot username topilmadi. Token to\'g\'riligini tekshiring yoki username ni qo\'lda kiriting.',
          variant: 'destructive',
        });
        return;
      }
      nextConfig = { ...nextConfig, botUsername: username };
      setConfig(nextConfig);
    }

    saveConfig.mutate({ ...nextConfig, commands });
  }, [config, commands, saveConfig, toast]);

  const copyBotLink = useCallback(() => {
    if (!config.botUsername) return;
    const link = `https://t.me/${config.botUsername}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Nusxa olindi', description: 'Bot havolasi nusxalandi' });
  }, [config.botUsername, toast]);

  const generateDeepLink = useCallback(() => {
    if (!config.botUsername) return '';
    return `https://t.me/${config.botUsername}?start=admin_${clinicId}`;
  }, [config.botUsername, clinicId]);

  const bookingStats = useMemo(() => {
    const today = new Date().toDateString();
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    return {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'pending').length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      today: bookings.filter(b => new Date(b.createdAt).toDateString() === today).length,
      thisWeek: bookings.filter(b => new Date(b.createdAt) >= thisWeek).length,
      conversionRate: bookings.length > 0 ? Math.round((bookings.filter(b => b.status === 'confirmed').length / bookings.length) * 100) : 0
    };
  }, [bookings]);

  const getStatusBadge = useCallback((status) => {
    const styles = {
      pending: { variant: 'secondary', label: 'Kutilmoqda' },
      confirmed: { variant: 'default', label: 'Tasdiqlangan' },
      cancelled: { variant: 'destructive', label: 'Bekor qilingan' },
      completed: { variant: 'outline', label: 'Yakunlangan' }
    };
    const style = styles[status] || styles.pending;
    return <Badge variant={style.variant}>{style.label}</Badge>;
  }, []);

  const weekDays = [
    { key: 'monday', label: 'Dushanba' },
    { key: 'tuesday', label: 'Seshanba' },
    { key: 'wednesday', label: 'Chorshanba' },
    { key: 'thursday', label: 'Payshanba' },
    { key: 'friday', label: 'Juma' },
    { key: 'saturday', label: 'Shanba' },
    { key: 'sunday', label: 'Yakshanba' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telegram Bot</h1>
          <p className="text-muted-foreground mt-1">Avtomatik navbat olish tizimi</p>
        </div>
        {botConfig && (
          <div className="flex items-center gap-4">
            <Badge variant={config.isActive ? 'default' : 'secondary'} className="text-sm">
              {config.isActive ? 'Bot faol' : 'Bot ochiq'}
            </Badge>
            <Button variant={config.isActive ? 'destructive' : 'default'} onClick={() => toggleBot.mutate(!config.isActive)} disabled={toggleBot.isPending}>
              {toggleBot.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : config.isActive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {config.isActive ? 'Ochirish' : 'Yoqish'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jami navbatlar</p>
                <p className="text-2xl font-bold">{bookingStats.total}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bugun</p>
                <p className="text-2xl font-bold">{bookingStats.today}</p>
              </div>
              <Clock className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Haftalik</p>
                <p className="text-2xl font-bold">{bookingStats.thisWeek}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Konversiya</p>
                <p className="text-2xl font-bold">{bookingStats.conversionRate}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard"><Bot className="w-4 h-4 mr-2" />Asosiy</TabsTrigger>
          <TabsTrigger value="bookings"><Calendar className="w-4 h-4 mr-2" />Navbatlar</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" />Sozlamalar</TabsTrigger>
          <TabsTrigger value="commands"><MessageSquare className="w-4 h-4 mr-2" />Buyruqlar</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bot malumotlari</CardTitle>
                <CardDescription>Telegram bot konfiguratsiyasi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Bot token</Label>
                  <Input type="password" value={config.botToken} onChange={(e) => handleConfigChange('botToken', e.target.value)} placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" />
                  <p className="text-xs text-muted-foreground mt-1">@BotFather dan olingan bot token</p>
                </div>
                <div>
                  <Label>Bot username</Label>
                  <Input value={config.botUsername} onChange={(e) => handleConfigChange('botUsername', e.target.value.replace('@', ''))} placeholder="dentalpro_bot" />
                  <p className="text-xs text-muted-foreground mt-1">Bo'sh qoldirsangiz, token orqali avtomatik olinadi</p>
                </div>
                {config.botUsername && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Bot className="w-5 h-5 text-blue-500" />
                    <span className="flex-1">t.me/{config.botUsername}</span>
                    <Button variant="ghost" size="sm" onClick={copyBotLink}><Copy className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`https://t.me/${config.botUsername}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                    </Button>
                  </div>
                )}
                
                {config.botUsername && (
                  <div className="p-4 bg-purple-50 rounded-2xl border-2 border-purple-100 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-purple-900 uppercase">Avtomatik bog'lanish</p>
                        <p className="text-[10px] text-purple-600 font-bold opacity-70 uppercase tracking-widest">Chat ID ni avtomatik olish uchun</p>
                      </div>
                    </div>
                    <Button 
                      variant="default" 
                      className="bg-purple-600 hover:bg-purple-700 text-white w-full rounded-xl font-black uppercase text-[10px] tracking-[0.2em] h-12"
                      asChild
                    >
                      <a href={generateDeepLink()} target="_blank" rel="noopener noreferrer">
                        <Smartphone className="w-4 h-4 mr-2" /> Botni boshlash
                      </a>
                    </Button>
                  </div>
                )}
                <div>
                  <Label>Lidlar uchun Chat ID</Label>
                  <Input value={config.leadChatId} onChange={(e) => handleConfigChange('leadChatId', e.target.value)} placeholder="-100123456789" />
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest opacity-60 italic">Kanal yoki gruppa ID raqami (-100 dan boshlanadi)</p>
                </div>
                <Button onClick={handleSaveConfig} disabled={saveConfig.isPending} className="w-full">
                  {saveConfig.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Saqlash
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test xabar</CardTitle>
                <CardDescription>Botdan test xabar yuborish</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Chat ID</Label>
                  <Input value={testChatId} onChange={(e) => setTestChatId(e.target.value)} placeholder="123456789" />
                </div>
                <div>
                  <Label>Xabar matni</Label>
                  <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="Test xabar..." rows={4} />
                </div>
                <Button onClick={() => sendTestMessage.mutate({ chatId: testChatId, message: testMessage })} disabled={!testChatId || !testMessage || sendTestMessage.isPending} className="w-full">
                  {sendTestMessage.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Yuborish
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Songgi navbatlar</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bookings.slice(0, 5).map(booking => (
                  <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{booking.patientName}</p>
                        <p className="text-sm text-gray-500">{booking.serviceType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm">{formatDate(booking.preferredDate)}</p>
                        <p className="text-sm text-gray-500">{booking.preferredTime}</p>
                      </div>
                      {getStatusBadge(booking.status)}
                    </div>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-4" />
                    <p>Hali navbatlar yoq</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Barcha navbatlar</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bookings.map(booking => (
                  <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Smartphone className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{booking.patientName}</p>
                        <p className="text-sm text-gray-500">@{booking.telegramUsername || 'Nomalum'}</p>
                        <p className="text-sm text-gray-500">{booking.serviceType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-medium">{formatDate(booking.preferredDate)}</p>
                        <p className="text-sm text-gray-500">{booking.preferredTime}</p>
                        <p className="text-xs text-gray-400">{formatDate(booking.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(booking.status)}
                        {booking.status === 'pending' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateBookingStatus.mutate({ id: booking.id, status: 'confirmed' })}>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateBookingStatus.mutate({ id: booking.id, status: 'cancelled' })}>
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setViewBooking(booking)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Umumiy sozlamalar</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tashrif buyurish xabari</Label>
                  <Textarea value={config.welcomeMessage} onChange={(e) => handleConfigChange('welcomeMessage', e.target.value)} rows={3} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Telefon raqam talab qilish</Label>
                    <p className="text-sm text-gray-500">Navbat olishda telefon raqamini sorash</p>
                  </div>
                  <Switch checked={config.requirePhone} onCheckedChange={(checked) => handleConfigChange('requirePhone', checked)} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Shu kunga navbat</Label>
                    <p className="text-sm text-gray-500">Shu kunning ozidayoq navbat olishga ruxsat</p>
                  </div>
                  <Switch checked={config.allowSameDay} onCheckedChange={(checked) => handleConfigChange('allowSameDay', checked)} />
                </div>
                <div>
                  <Label>Oldindan bron qilish (kun)</Label>
                  <Input type="number" value={config.bookingAdvanceDays} onChange={(e) => handleConfigChange('bookingAdvanceDays', parseInt(e.target.value))} min={1} max={90} />
                </div>
                <div>
                  <Label>Navbat davomiyligi (daqiqa)</Label>
                  <Select value={config.slotDuration.toString()} onValueChange={(value) => handleConfigChange('slotDuration', parseInt(value))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 daqiqa</SelectItem>
                      <SelectItem value="30">30 daqiqa</SelectItem>
                      <SelectItem value="45">45 daqiqa</SelectItem>
                      <SelectItem value="60">60 daqiqa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Ish vaqti</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {weekDays.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <Switch checked={config.workingHours[key]?.isOpen} onCheckedChange={(checked) => handleWorkingHoursChange(key, 'isOpen', checked)} />
                      <span className="w-24">{label}</span>
                      {config.workingHours[key]?.isOpen ? (
                        <>
                          <Input type="time" value={config.workingHours[key]?.start} onChange={(e) => handleWorkingHoursChange(key, 'start', e.target.value)} className="w-24" />
                          <span>-</span>
                          <Input type="time" value={config.workingHours[key]?.end} onChange={(e) => handleWorkingHoursChange(key, 'end', e.target.value)} className="w-24" />
                        </>
                      ) : (
                        <span className="text-gray-400">Yopiq</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Xizmatlar royxati</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={config.availableServices.join('\n')} onChange={(e) => handleServicesChange(e.target.value)} rows={8} placeholder="Har bir qatorda bitta xizmat" />
              <p className="text-sm text-gray-500 mt-2">Har bir qatorda bitta xizmat turini yozing</p>
            </CardContent>
          </Card>

          <Button onClick={handleSaveConfig} disabled={saveConfig.isPending} size="lg">
            {saveConfig.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Sozlamalarni saqlash
          </Button>
        </TabsContent>

        <TabsContent value="commands" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bot buyruqlari</CardTitle>
              <CardDescription>Telegram bot buyruqlarini sozlash</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {commands.map((cmd, index) => (
                  <div key={cmd.command} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{cmd.command}</code>
                        <Badge variant={cmd.isActive ? 'default' : 'secondary'}>{cmd.isActive ? 'Faol' : 'Ochiq'}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{cmd.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingCommand({ ...cmd, index })}>Tahrirlash</Button>
                      <Switch checked={cmd.isActive} onCheckedChange={(checked) => { const newCommands = [...commands]; newCommands[index].isActive = checked; setCommands(newCommands); }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveConfig} disabled={saveConfig.isPending} size="lg">
            {saveConfig.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Buyruqlarni saqlash
          </Button>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingCommand} onOpenChange={() => setEditingCommand(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buyruqni tahrirlash</DialogTitle></DialogHeader>
          {editingCommand && (
            <div className="space-y-4">
              <div>
                <Label>Buyruq</Label>
                <Input value={editingCommand.command} disabled />
              </div>
              <div>
                <Label>Tavsif</Label>
                <Input value={editingCommand.description} onChange={(e) => setEditingCommand({ ...editingCommand, description: e.target.value })} />
              </div>
              <div>
                <Label>Javob xabari</Label>
                <Textarea value={editingCommand.response} onChange={(e) => setEditingCommand({ ...editingCommand, response: e.target.value })} rows={6} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => { const newCommands = [...commands]; newCommands[editingCommand.index] = { command: editingCommand.command, description: editingCommand.description, response: editingCommand.response, isActive: editingCommand.isActive }; setCommands(newCommands); setEditingCommand(null); }}>
                  <Save className="w-4 h-4 mr-2" />Saqlash
                </Button>
                <Button variant="outline" onClick={() => setEditingCommand(null)}>Bekor qilish</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Navbat malumotlari</DialogTitle></DialogHeader>
          {viewBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Bemor</Label>
                  <p className="font-medium">{viewBooking.patientName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Telegram</Label>
                  <p className="font-medium">@{viewBooking.telegramUsername || 'Nomalum'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Telefon</Label>
                  <p className="font-medium">{viewBooking.phoneNumber || 'Korsatilmagan'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Xizmat</Label>
                  <p className="font-medium">{viewBooking.serviceType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Sana</Label>
                  <p className="font-medium">{formatDate(viewBooking.preferredDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vaqt</Label>
                  <p className="font-medium">{viewBooking.preferredTime}</p>
                </div>
              </div>
              {viewBooking.notes && (
                <div>
                  <Label className="text-muted-foreground">Izoh</Label>
                  <p>{viewBooking.notes}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">{getStatusBadge(viewBooking.status)}</div>
              </div>
              <Separator />
              <div className="text-sm text-gray-500">
                <p>Navbat ID: {viewBooking.id}</p>
                <p>Yaratilgan: {formatDate(viewBooking.createdAt)}</p>
                {viewBooking.confirmedAt && <p>Tasdiqlangan: {formatDate(viewBooking.confirmedAt)}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
