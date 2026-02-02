import CynaHeader from "@/components/ui/CynaHeader";
import { StyleSheet, Text, View } from "react-native";

export default function Dashboard() {
  return (
    <View style={styles.container}>
      <CynaHeader />

      <View style={styles.content}>
        <Text style={styles.title}>🔥 BIENVENUE SUR CYNA </Text>
        <Text style={styles.subtitle}>
          T’es connecté. Profite de la meilleure app 😎
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
});
