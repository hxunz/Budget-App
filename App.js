import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'budget_expenses_v1';
const WEEKLY_BUDGET = 70; // 주간 생활비 (파운드)
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// ---- 날짜 유틸 ----
function toDateKey(d) {
  // YYYY-MM-DD (로컬 기준)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = 일요일
  const diff = day === 0 ? -6 : 1 - day; // 월요일 시작
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export default function App() {
  const [expenses, setExpenses] = useState([]); // { id, dateKey, amount, memo }
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [loaded, setLoaded] = useState(false);

  const today = new Date();
  const todayKey = toDateKey(today);
  const monday = getMonday(today);

  // 최초 로드
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setExpenses(JSON.parse(raw));
      } catch (e) {
        console.warn('불러오기 실패', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // 변경될 때마다 저장
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)).catch((e) =>
      console.warn('저장 실패', e)
    );
  }, [expenses, loaded]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const key = toDateKey(date);
      const total = expenses
        .filter((e) => e.dateKey === key)
        .reduce((sum, e) => sum + e.amount, 0);
      return { key, label: DAY_LABELS[i], date, total, isToday: key === todayKey };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, todayKey]);

  const weekTotal = weekDays.reduce((sum, d) => sum + d.total, 0);
  const remaining = WEEKLY_BUDGET - weekTotal;
  const progress = Math.min(weekTotal / WEEKLY_BUDGET, 1);

  const todayExpenses = expenses
    .filter((e) => e.dateKey === todayKey)
    .sort((a, b) => b.createdAt - a.createdAt);

  const barColor = progress < 0.7 ? '#34c759' : progress < 1 ? '#ff9500' : '#ff3b30';

  function handleAdd() {
    const value = parseFloat(amount.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('금액을 확인해주세요', '0보다 큰 숫자를 입력해주세요.');
      return;
    }
    const newExpense = {
      id: Date.now().toString(),
      dateKey: todayKey,
      amount: value,
      memo: memo.trim(),
      createdAt: Date.now(),
    };
    setExpenses((prev) => [...prev, newExpense]);
    setAmount('');
    setMemo('');
  }

  function handleDelete(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={todayExpenses}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>가계부</Text>

              {/* 주간 요약 */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>이번 주 사용액</Text>
                <Text style={styles.summaryAmount}>
                  £{weekTotal.toFixed(2)}{' '}
                  <Text style={styles.summaryTotal}>/ £{WEEKLY_BUDGET.toFixed(2)}</Text>
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>
                <Text style={[styles.remaining, { color: remaining < 0 ? '#ff3b30' : '#666' }]}>
                  {remaining >= 0
                    ? `남은 예산 £${remaining.toFixed(2)}`
                    : `£${Math.abs(remaining).toFixed(2)} 초과`}
                </Text>
              </View>

              {/* 요일별 내역 */}
              <View style={styles.weekRow}>
                {weekDays.map((d) => (
                  <View
                    key={d.key}
                    style={[styles.dayBox, d.isToday && styles.dayBoxToday]}
                  >
                    <Text style={[styles.dayLabel, d.isToday && styles.dayLabelToday]}>
                      {d.label}
                    </Text>
                    <Text style={[styles.dayAmount, d.isToday && styles.dayLabelToday]}>
                      {d.total > 0 ? d.total.toFixed(0) : '-'}
                    </Text>
                  </View>
                ))}
              </View>

              {/* 입력 폼 */}
              <View style={styles.inputRow}>
                <View style={styles.amountInputWrap}>
                  <Text style={styles.poundSign}>£</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
                <TextInput
                  style={styles.memoInput}
                  placeholder="메모 (선택)"
                  value={memo}
                  onChangeText={setMemo}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                  <Text style={styles.addButtonText}>추가</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>오늘 지출 내역</Text>
              {todayExpenses.length === 0 && (
                <Text style={styles.emptyText}>아직 기록이 없어요.</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.expenseRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.expenseAmount}>£{item.amount.toFixed(2)}</Text>
                {!!item.memo && <Text style={styles.expenseMemo}>{item.memo}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f7f8' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryLabel: { fontSize: 13, color: '#888', marginBottom: 4 },
  summaryAmount: { fontSize: 30, fontWeight: '700', marginBottom: 12 },
  summaryTotal: { fontSize: 16, fontWeight: '400', color: '#999' },
  progressTrack: {
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 5 },
  remaining: { fontSize: 14, fontWeight: '500' },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dayBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 2,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  dayBoxToday: { backgroundColor: '#1c1c1e' },
  dayLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  dayLabelToday: { color: '#fff' },
  dayAmount: { fontSize: 13, fontWeight: '600', color: '#333' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
    width: 100,
  },
  poundSign: { fontSize: 16, color: '#888', marginRight: 2 },
  amountInput: { flex: 1, fontSize: 16 },
  memoInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#999', fontSize: 14, marginBottom: 8 },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  expenseAmount: { fontSize: 16, fontWeight: '600' },
  expenseMemo: { fontSize: 13, color: '#888', marginTop: 2 },
  deleteText: { color: '#ff3b30', fontSize: 13 },
});
