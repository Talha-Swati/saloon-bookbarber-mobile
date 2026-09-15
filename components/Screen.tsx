import {PropsWithChildren} from 'react';
import {ScrollView,StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors,spacing} from '@/constants/theme';
export function Screen({children}:PropsWithChildren){
  return <SafeAreaView style={s.safe} edges={['top','bottom']}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{children}</ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},content:{flexGrow:1,padding:spacing.md,paddingBottom:48}});

