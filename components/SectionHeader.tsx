import {StyleSheet,Text,View} from 'react-native';import {colors,spacing} from '@/constants/theme';
export function SectionHeader({title,action}:{title:string;action?:string}){return <View style={s.row}><Text style={s.title}>{title}</Text>{action&&<Text style={s.action}>{action}</Text>}</View>};
const s=StyleSheet.create({row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:spacing.md},title:{color:colors.text,fontSize:20,fontWeight:'700'},action:{color:colors.dark,fontSize:14,fontWeight:'700'}});
