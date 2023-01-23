import { useEffect, useState, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import axios from "axios";
import Constants from "expo-constants";
import Logo from "./assets/icon.png";
import NoFound from "./assets/notFound.png";
import Loading from "./assets/loading.png";
import NoConnection from "./assets/noConnection.png";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import NetInfo from "@react-native-community/netinfo";
import * as WebBrowser from "expo-web-browser";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const PADDING_STATUS = Constants.statusBarHeight;

const handlePress = async (id) =>
  await WebBrowser.openBrowserAsync(
    `https://penssum.com/post/information/${id}`
  );

const convertDate = (date) => {
  const dateFound = new Date(date);
  const day = ("0" + dateFound.getDate()).slice(-2);
  const month = ("0" + (dateFound.getMonth() + 1)).slice(-2);
  const year = dateFound.getFullYear();

  return `${day}-${month}-${year}`;
};

const StylizedText = ({ small, big, color, children, mb, ...restOfProps }) => {
  const textStyles = [
    styles.text,
    small && styles.textSmall,
    big && styles.textBig,
    color === "secondary" && styles.ColorSecundary,
    color === "tertiary" && styles.ColorTertiary,
    color === "white" && styles.ColorWhite,
    !color && styles.textColorDefault,
    mb && styles.marginBottom,
  ];

  return (
    <Text style={textStyles} {...restOfProps}>
      {children}
    </Text>
  );
};

const Button = ({ title, color, event, data }) => {
  return (
    <TouchableOpacity
      style={[
        {
          backgroundColor:
            color === "secondary"
              ? colors.ColorSecundary
              : color === "tertiary"
              ? colors.ColorTertiary
              : "",
        },
        styles.button,
      ]}
      onPress={() => event(data)}
    >
      <Text style={styles.textButton}>{title}</Text>
    </TouchableOpacity>
  );
};

const Products = ({ item, removeProduct, acceptProduct }) => {
  return (
    <View style={styles.productsContainer}>
      <TouchableOpacity
        onPress={() => handlePress(item._id)}
        style={{ width: "100%" }}
      >
        <Image
          style={styles.productImage}
          source={{ uri: item.linkMiniature }}
        />
        <View style={styles.productDescription}>
          <StylizedText big color="secondary" bold>
            {item.category}
          </StylizedText>
          <View style={styles.productDivider}>
            <StylizedText small>{item.subCategory}: </StylizedText>
            <StylizedText small color="secondary">
              {item.customCategory}
            </StylizedText>
          </View>
          <View style={styles.productDivider}>
            <StylizedText small>Fecha de entrega: </StylizedText>
            <StylizedText small color="secondary">
              {convertDate(item.dateOfDelivery)}
            </StylizedText>
          </View>
          <StylizedText small>{item.description}</StylizedText>
          <View style={styles.productDivider}>
            <StylizedText small>Precio: </StylizedText>
            <StylizedText big color="secondary">
              ${item.valueString}
            </StylizedText>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <Button
          title="APROBAR"
          color="secondary"
          event={acceptProduct}
          data={{ id: item._id }}
        />
        <Button
          title="DESAPROBAR"
          color="tertiary"
          event={removeProduct}
          data={{ id: item._id, files: item.files }}
        />
      </View>
    </View>
  );
};

export default function App() {
  const [products, setProducts] = useState(null);
  const [refresing, setRefresing] = useState(false);
  const [connected, setConnected] = useState(null);

  const timer = useRef();
  const notificationListener = useRef();

  const isConnected = () => {
    NetInfo.fetch().then((state) => setConnected(state.isConnected));
    if (!connected) setProducts(null);
    return connected;
  };

  const acceptProduct = async ({ id }) => {
    const newProducts = products.filter((product) => product._id !== id);
    setProducts(newProducts);
    const connection = await isConnected();
    if (connection) {
      await axios.post("https://penssum.com/product/accept", { id });
    }
  };

  const removeProduct = async ({ id, files }) => {
    const newProducts = products.filter((product) => product._id !== id);
    setProducts(newProducts);
    const connection = await isConnected();
    if (connection) {
      await axios.post("https://penssum.com/product/remove/files", {
        files,
        activate: true,
      });
      await axios.post("https://penssum.com/product/remove", {
        id,
        notification: true,
      });
    }
  };

  const getProducts = async () => {
    try {
      const products = await axios.post("https://penssum.com/products", {
        review: true,
      });
      setProducts(products.data);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    if (!connected) timer.current = setInterval(() => isConnected(), 1000);
    if (connected) {
      clearInterval(timer.current);
      getProducts();
      registerForPushNotificationsAsync().then((token) => console.log(token));
    }

    return () => clearInterval(timer.current);
  }, [connected]);

  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {
        getProducts();
      });
    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current
      );
    };
  }, []);

  const onRefresh = async () => {
    setRefresing(true);
    await getProducts();
    setRefresing(false);
  };

  async function registerForPushNotificationsAsync() {
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        return;
      }
      token = (await Notifications.getExpoPushTokenAsync()).data;

      try {
        const value = await AsyncStorage.getItem("@token");
        if (!value && connected) {
          await axios.post("https://penssum.com/apk/device/add", {
            deviceID: token,
          });

          try {
            await AsyncStorage.setItem("@token", token);
          } catch (e) {
            console.log(e);
          }
        }
      } catch (e) {
        console.log(e);
      }
    }

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    return token;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.ColorPrimary} />
      <View style={styles.nav}>
        <Image source={Logo} style={styles.navImage} />
        <Text style={styles.navText}>Penssum ADMIN</Text>
      </View>
      {connected && products && (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <Products
              item={item}
              removeProduct={removeProduct}
              acceptProduct={acceptProduct}
            />
          )}
          style={styles.productsContainerFlazList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refresing}
              colors={["#ffffff"]}
              onRefresh={onRefresh}
              progressBackgroundColor={colors.ColorPrimary}
            />
          }
        />
      )}
      {(products === null || products.length === 0 || connected === false) && (
        <View style={styles.searchContainer}>
          {connected && products === null && (
            <View style={styles.center}>
              <StylizedText big color="secondary">
                ... CARGANDO ...
              </StylizedText>
              <Image source={Loading} style={styles.imageBig} />
            </View>
          )}
          {connected && products !== null && products.length === 0 && (
            <View style={styles.center}>
              <StylizedText big color="secondary" mb>
                NO HAY PUBLICACIONES
              </StylizedText>
              <Image source={NoFound} style={styles.notFoundImage} />
            </View>
          )}
          {connected === false && (
            <View style={styles.center}>
              <StylizedText big color="secondary">
                SIN CONEXIÓN
              </StylizedText>
              <Image source={NoConnection} style={styles.imageBig} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const colors = {
  ColorPrimary: "#1B262C",
  ColorSecundary: "#3282B8",
  ColorTertiary: "#0F4C75",
  ColorWhite: "#EEEEEE",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
    marginTop: PADDING_STATUS,
  },
  productsContainerFlazList: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    width: "90%",
    marginBottom: 30,
  },
  nav: {
    backgroundColor: colors.ColorPrimary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  navText: {
    fontSize: 22,
    color: colors.ColorWhite,
  },
  navImage: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  productsContainer: {
    marginBottom: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 5,
  },
  productImage: {
    width: "100%",
    height: 220,
  },
  productDescription: {
    marginTop: 14,
    width: "100%",
  },
  buttonContainer: {
    marginTop: 20,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    padding: 10,
    width: "45%",
    borderRadius: 10,
  },
  textButton: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
  textBig: { fontSize: 26 },
  textSmall: { fontSize: 20 },
  textColorDefault: { color: "#666666" },
  text: {
    fontSize: 16,
    color: "#666666",
  },
  ColorSecundary: { color: colors.ColorSecundary },
  ColorTertiary: { color: colors.ColorTertiary },
  ColorWhite: { color: colors.ColorWhite },
  marginBottom: { marginBottom: 20 },
  productDivider: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  searchContainer: {
    flexGrow: 1,
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
  },
  notFoundImage: {
    width: 160,
    height: 160,
  },
  imageBig: {
    width: 400,
    height: 400,
  },
  center: { alignItems: "center" },
});
