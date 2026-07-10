import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Modal } from "react-native";
import { api } from "../lib/api";

export function SharePostModal({ visible, onClose, institutionId }: { visible: boolean, onClose: () => void, institutionId: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    try {
      await api.institutions.postRequest(institutionId, { title, description });
      alert("Request sent successfully!");
      onClose();
    } catch (e) {
      alert("Error sending request");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.header}>Share Post to Institution</Text>
          <TextInput style={styles.input} placeholder="Post Title" value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder="Post Description" value={description} onChangeText={setDescription} multiline />
          <Button title="Submit Request" onPress={handleSubmit} />
          <Button title="Cancel" onPress={onClose} color="red" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  container: { backgroundColor: "white", padding: 20, borderRadius: 10 },
  header: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 15, borderRadius: 5 }
});
