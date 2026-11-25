import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { parseVless, buildXrayConfig } from './vless';

const { VlessVpn } = NativeModules;

const C = {
  bg: '#05070B',
  panel: '#0D1220',
  line: '#1E2A40',
  cyan: '#27E1FF',
  violet: '#8B5CF6',
  ok: '#22F5A0',
  bad: '#FF4D6D',
  text: '#E6EEFF',
  mute: '#6B7A99',
};

export default function App() {
  const [servers, setServers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: on ? 800 : 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: on ? 800 : 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [on, pulse]);

  useEffect(() => {
    (async () => {
      try {
        if (VlessVpn) {
          const raw = await VlessVpn.loadPrefs();
          if (raw) {
            const p = JSON.parse(raw);
            setServers(p.servers || []);
            setSelected(p.selected || null);
          }
          setOn(await VlessVpn.isRunning());
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded && VlessVpn) VlessVpn.savePrefs(JSON.stringify({ servers, selected }));
  }, [loaded, servers, selected]);

  const addServer = () => {
    try {
      const sv = parseVless(input);
      setServers((list) => [...list, sv]);
      setSelected(sv.id);
      setInput('');
      setMsg(`سرور «${sv.name}» اضافه شد`);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const removeServer = (id) => {
    setServers((list) => list.filter((s) => s.id !== id));
    if (selected === id) setSelected(null);
  };

  const toggle = async () => {
    if (!VlessVpn) return setMsg('ماژول نیتیو پیدا نشد. باید APK بیلد شده نصب بشه.');
    const sv = servers.find((s) => s.id === selected);
    setBusy(true);
    setMsg('');
    try {
      if (on) {
        await VlessVpn.stop();
        setOn(false);
      } else {
        if (!sv) throw new Error('اول یه سرور اضافه و انتخاب کن');
        await VlessVpn.start(JSON.stringify(buildXrayConfig(sv)));
        await new Promise((r) => setTimeout(r, 1500));
        const running = await VlessVpn.isRunning();
        setOn(running);
        if (!running) setMsg('اتصال برقرار نشد. کانفیگ یا سرور رو چک کن.');
      }
    } catch (e) {
      setMsg(e && e.code === 'DENIED' ? 'اجازه‌ی VPN داده نشد.' : (e && e.message) || 'خطا');
    }
    setBusy(false);
  };

  const active = servers.find((s) => s.id === selected);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>
          VLESS<Text style={{ color: C.cyan }}> VPN</Text>
        </Text>
        <Text style={s.sub}>{active ? `سرور: ${active.name}` : 'هنوز سروری انتخاب نشده'}</Text>

        <View style={s.hero}>
          <Animated.View
            style={[
              s.ring,
              { borderColor: on ? C.ok : C.cyan, transform: [{ scale: ringScale }] },
            ]}
          />
          <TouchableOpacity activeOpacity={0.85} disabled={busy} onPress={toggle} style={[s.power, { borderColor: on ? C.ok : C.violet }]}>
            <Text style={[s.powerText, { color: on ? C.ok : C.cyan }]}>{busy ? '...' : on ? 'قطع' : 'اتصال'}</Text>
            <Text style={s.powerSub}>{on ? 'متصل' : 'قطع'}</Text>
          </TouchableOpacity>
        </View>

        {!!msg && <Text style={s.msg}>{msg}</Text>}

        <View style={s.card}>
          <Text style={s.cardTitle}>افزودن سرور</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="vless://..."
            placeholderTextColor="#3A4663"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={s.input}
          />
          <TouchableOpacity onPress={addServer} style={s.btn}>
            <Text style={s.btnText}>ذخیره‌ی سرور</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.section}>سرورها</Text>
        {servers.length === 0 && <Text style={s.empty}>هنوز سروری ذخیره نشده</Text>}
        {servers.map((sv) => (
          <View key={sv.id} style={[s.server, selected === sv.id && { borderColor: C.cyan }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelected(sv.id)}>
              <Text style={s.serverName}>{sv.name}</Text>
              <Text style={s.serverMeta}>
                {sv.address}:{sv.port} · {sv.network} · {sv.security}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeServer(sv.id)} style={s.del}>
              <Text style={{ color: C.bad, fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const rtl = { textAlign: 'right', writingDirection: 'rtl' };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 18, paddingTop: 54, paddingBottom: 40 },
  title: { color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: 3 },
  sub: { color: C.mute, marginTop: 4, fontSize: 12, ...rtl },
  hero: { height: 260, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 2, opacity: 0.5 },
  power: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  powerText: { fontSize: 22, fontWeight: '900' },
  powerSub: { color: C.mute, fontSize: 12, marginTop: 4 },
  msg: { color: C.cyan, textAlign: 'center', marginBottom: 10, ...rtl, textAlign: 'center' },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginTop: 6 },
  cardTitle: { color: C.text, fontWeight: '800', marginBottom: 8, ...rtl },
  input: { backgroundColor: '#080C16', borderWidth: 1, borderColor: C.line, borderRadius: 10, color: C.text, padding: 12, minHeight: 70, textAlign: 'left', writingDirection: 'ltr', fontSize: 13 },
  btn: { marginTop: 10, backgroundColor: C.violet, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
  section: { color: C.mute, fontSize: 12, marginTop: 18, marginBottom: 6, ...rtl },
  empty: { color: C.mute, textAlign: 'center', marginTop: 10 },
  server: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, marginBottom: 8 },
  serverName: { color: C.text, fontWeight: '800', fontSize: 15 },
  serverMeta: { color: C.mute, fontSize: 11, marginTop: 4, textAlign: 'left' },
  del: { paddingHorizontal: 10, paddingVertical: 4 },
});
