import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet,
  KeyboardAvoidingView, Platform, BackHandler, SafeAreaView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = { o: '#FF6B00', bg: '#17120D', p: '#221A12', p2: '#2D231A', t: '#FFF3E8', m: '#A8967F', mine: '#C54F00' };
const KEY = 'khaste.v1';
const COLORS = ['#FF6B00', '#FFB347', '#FF8A5C', '#F4A261', '#E9C46A'];
const colOf = (n) => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const TAG = { p: '', g: ' · گروه', c: ' · کانال' };
const REPLIES = ['باشه 👍', 'دمت گرم', 'بعداً حرف می‌زنیم', '😂😂', 'خسته نباشی!', 'ممنون که خبر دادی'];
const hm = (t) => new Date(t).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

function seed(me) {
  const n = Date.now();
  return [
    { id: 'c1', t: 'p', name: 'مامان', owner: 'x', msgs: [{ f: 'مامان', x: 'سلام عزیزم، شام میای؟ 🍲', at: n - 3600000 }] },
    { id: 'c2', t: 'g', name: 'خانواده', owner: me.id, members: ['مامان', 'بابا', 'داداش'], msgs: [{ f: 'بابا', x: 'فردا همه خونه‌ی ما', at: n - 7200000 }] },
    { id: 'c3', t: 'c', name: 'اخبار خسته', owner: me.id, msgs: [{ f: me.name, x: 'به کانال خوش اومدید ☕', at: n - 9000000 }] },
  ];
}

export default function App() {
  const [S, setS] = useState(null);       // { me, chats }
  const [ready, setReady] = useState(false);
  const [cur, setCur] = useState(null);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [dlg, setDlg] = useState(null);   // { kind, step, name }
  const [dv, setDv] = useState('');
  const [nm, setNm] = useState('');
  const [idv, setIdv] = useState('');
  const [err, setErr] = useState('');
  const [txt, setTxt] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setS(JSON.parse(v)); }).finally(() => setReady(true));
  }, []);
  const persist = (n) => { setS(n); AsyncStorage.setItem(KEY, JSON.stringify(n)).catch(() => {}); };

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => (cur ? (setCur(null), true) : false));
    return () => h.remove();
  }, [cur]);

  const login = () => {
    const ok = /^\S+@\S+\.\S+$/.test(idv.trim()) || /^(\+98|0)?9\d{9}$/.test(idv.replace(/[\s-]/g, ''));
    if (!nm.trim() || !ok) return setErr('نام و یک ایمیل یا شماره موبایل معتبر وارد کنید');
    const me = { id: idv.trim(), name: nm.trim() };
    persist(S && S.me.id === me.id ? { ...S, me } : { me, chats: seed(me) });
  };

  if (!ready) return <View style={st.root} />;

  if (!S) {
    return (
      <SafeAreaView style={st.root}>
        <StatusBar barStyle="light-content" />
        <View style={st.login}>
          <View style={st.logo}><Text style={{ fontSize: 40 }}>😴</Text></View>
          <Text style={st.title}>خسته</Text>
          <Text style={st.muted}>پیام‌رسان ساده برای خودمون</Text>
          <TextInput style={st.input} placeholder="نام شما" placeholderTextColor={C.m} value={nm} onChangeText={setNm} />
          <TextInput style={[st.input, { textAlign: 'left' }]} placeholder="ایمیل یا شماره موبایل" placeholderTextColor={C.m}
            value={idv} onChangeText={setIdv} autoCapitalize="none" keyboardType="email-address" />
          <TouchableOpacity style={st.btn} onPress={login}><Text style={st.btnT}>ورود</Text></TouchableOpacity>
          {!!err && <Text style={{ color: '#ff8a66' }}>{err}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const chat = S.chats.find((c) => c.id === cur);
  const lastOf = (c) => c.msgs[c.msgs.length - 1] || { x: '', at: 0 };
  const upd = (id, fn) => persist({ ...S, chats: S.chats.map((c) => (c.id === id ? fn(c) : c)) });

  const send = () => {
    const x = txt.trim(); if (!x || !chat) return;
    const id = chat.id;
    upd(id, (c) => ({ ...c, msgs: [...c.msgs, { f: S.me.name, x, at: Date.now() }] }));
    setTxt('');
    if (chat.t !== 'c') {
      const who = chat.t === 'p' ? chat.name : chat.members[Math.floor(Math.random() * chat.members.length)];
      setTimeout(() => {
        const r = REPLIES[Math.floor(Math.random() * REPLIES.length)];
        setS((p) => {
          const n = { ...p, chats: p.chats.map((c) => (c.id === id ? { ...c, msgs: [...c.msgs, { f: who, x: r, at: Date.now() }] } : c)) };
          AsyncStorage.setItem(KEY, JSON.stringify(n)).catch(() => {});
          return n;
        });
      }, 1200);
    }
  };

  const dlgOk = () => {
    const v = dv.trim(); setDv('');
    if (dlg.step === 'name') {
      if (!v) return setDlg(null);
      if (dlg.kind === 'g') return setDlg({ ...dlg, step: 'members', name: v });
      return finish(dlg.kind, v, null);
    }
    const m = v.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
    finish('g', dlg.name, m.length ? m : ['دوست']);
  };
  const finish = (kind, name, members) => {
    const c = { id: 'c' + Date.now(), t: kind, name, owner: S.me.id, msgs: [], ...(members ? { members } : {}) };
    persist({ ...S, chats: [...S.chats, c] }); setDlg(null); setCur(c.id);
  };

  if (chat) {
    const canPost = chat.t !== 'c' || chat.owner === S.me.id;
    return (
      <SafeAreaView style={st.root}>
        <StatusBar barStyle="light-content" />
        <View style={st.hd}>
          <TouchableOpacity onPress={() => setCur(null)} style={st.ic}><Text style={st.icT}>→</Text></TouchableOpacity>
          <View style={[st.av, { backgroundColor: colOf(chat.name) }]}><Text style={st.avT}>{chat.name[0]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{chat.name}</Text>
            <Text style={st.sub}>{chat.t === 'g' ? `${chat.members.length + 1} عضو` : chat.t === 'c' ? 'کانال' : 'آنلاین'}</Text>
          </View>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList ref={listRef} data={chat.msgs} keyExtractor={(_, i) => String(i)} contentContainerStyle={{ padding: 12, gap: 6 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const me = item.f === S.me.name;
              return (
                <View style={[st.bub, me ? st.me : st.ot]}>
                  {chat.t !== 'p' && !me && <Text style={st.who}>{item.f}</Text>}
                  <Text style={st.msg}>{item.x}</Text>
                  <Text style={st.time}>{hm(item.at)}</Text>
                </View>
              );
            }} />
          {canPost ? (
            <View style={st.bar}>
              <TouchableOpacity style={st.send} onPress={send}><Text style={{ fontSize: 20, color: '#1a0d00' }}>➤</Text></TouchableOpacity>
              <TextInput style={[st.input, { flex: 1, borderRadius: 22 }]} placeholder="پیام..." placeholderTextColor={C.m}
                value={txt} onChangeText={setTxt} onSubmitEditing={send} />
            </View>
          ) : <Text style={st.ro}>فقط ادمین کانال می‌تونه پیام بذاره</Text>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const data = S.chats.filter((c) => !q.trim() || c.name.includes(q.trim())).sort((a, b) => lastOf(b).at - lastOf(a).at);
  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="light-content" />
      <View style={st.top}>
        <TouchableOpacity style={st.ic} onPress={() => { AsyncStorage.removeItem(KEY).catch(() => {}); setS(null); }}><Text style={st.icT}>⏻</Text></TouchableOpacity>
        <Text style={st.h}>خسته</Text>
      </View>
      <TextInput style={[st.input, { margin: 12, marginTop: 0 }]} placeholder="جستجو در گفتگوها" placeholderTextColor={C.m} value={q} onChangeText={setQ} />
      <FlatList data={data} keyExtractor={(c) => c.id} renderItem={({ item: c }) => (
        <TouchableOpacity style={st.row} onPress={() => setCur(c.id)}>
          <View style={[st.av, { backgroundColor: colOf(c.name) }]}><Text style={st.avT}>{c.name[0]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{c.name}<Text style={st.tag}>{TAG[c.t]}</Text></Text>
            <Text style={st.sub} numberOfLines={1}>{lastOf(c).x || 'بدون پیام'}</Text>
          </View>
        </TouchableOpacity>
      )} />
      {menu && (
        <View style={st.menu}>
          {[['p', 'پیام شخصی جدید'], ['g', 'گروه جدید'], ['c', 'کانال جدید']].map(([k, l]) => (
            <TouchableOpacity key={k} style={st.mi} onPress={() => { setMenu(false); setDlg({ kind: k, step: 'name' }); }}>
              <Text style={{ color: C.t, textAlign: 'right' }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TouchableOpacity style={st.fab} onPress={() => setMenu(!menu)}><Text style={{ fontSize: 30, color: '#1a0d00', fontWeight: '800' }}>+</Text></TouchableOpacity>
      <Modal visible={!!dlg} transparent animationType="fade" onRequestClose={() => setDlg(null)}>
        <View style={st.ov}><View style={st.box}>
          <Text style={st.name}>{dlg?.step === 'members' ? 'اعضا را با ویرگول جدا کنید' : { p: 'نام مخاطب', g: 'نام گروه', c: 'نام کانال' }[dlg?.kind]}</Text>
          <TextInput style={st.input} value={dv} onChangeText={setDv} autoFocus onSubmitEditing={dlgOk} />
          <TouchableOpacity style={st.btn} onPress={dlgOk}><Text style={st.btnT}>تأیید</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setDlg(null); setDv(''); }}><Text style={[st.muted, { textAlign: 'center' }]}>انصراف</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  login: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  logo: { width: 96, height: 96, borderRadius: 26, backgroundColor: C.o, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  title: { color: C.t, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  muted: { color: C.m, textAlign: 'center' },
  input: { backgroundColor: C.p2, color: C.t, borderRadius: 14, padding: 12, textAlign: 'right', fontSize: 15 },
  btn: { backgroundColor: C.o, borderRadius: 14, padding: 13, alignItems: 'center' },
  btnT: { color: '#1a0d00', fontWeight: '800', fontSize: 16 },
  top: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 14 },
  h: { color: C.o, fontSize: 24, fontWeight: '800', flex: 1, textAlign: 'right' },
  ic: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.p2, alignItems: 'center', justifyContent: 'center' },
  icT: { color: C.t, fontSize: 18 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 16 },
  av: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avT: { color: '#1a0d00', fontWeight: '800', fontSize: 19 },
  name: { color: C.t, fontWeight: '700', fontSize: 15, textAlign: 'right' },
  tag: { color: C.o, fontSize: 11, fontWeight: '400' },
  sub: { color: C.m, textAlign: 'right', marginTop: 2 },
  fab: { position: 'absolute', bottom: 24, left: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  menu: { position: 'absolute', bottom: 92, left: 20, backgroundColor: C.p2, borderRadius: 16, overflow: 'hidden' },
  mi: { paddingVertical: 13, paddingHorizontal: 22 },
  hd: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 10, backgroundColor: C.p },
  bub: { maxWidth: '78%', padding: 9, paddingHorizontal: 12, borderRadius: 16 },
  me: { alignSelf: 'flex-start', backgroundColor: C.mine, borderBottomLeftRadius: 4 },
  ot: { alignSelf: 'flex-end', backgroundColor: C.p2, borderBottomRightRadius: 4 },
  who: { color: '#FF8A33', fontSize: 12, fontWeight: '600', textAlign: 'right' },
  msg: { color: C.t, fontSize: 15, textAlign: 'right', lineHeight: 24 },
  time: { color: '#ffffff88', fontSize: 11, textAlign: 'left', marginTop: 2 },
  bar: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: C.p, alignItems: 'center' },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] },
  ro: { color: C.m, textAlign: 'center', padding: 16, backgroundColor: C.p },
  ov: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: C.p, borderRadius: 18, padding: 18, gap: 12 },
});
