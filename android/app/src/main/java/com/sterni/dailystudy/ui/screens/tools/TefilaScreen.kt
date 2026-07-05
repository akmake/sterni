package com.sterni.dailystudy.ui.screens.tools

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.Primary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TefilaScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("תפילה וכיוון ירושלים") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "חזור")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("מצפן כיוון ירושלים", fontSize = 24.sp, fontWeight = FontWeight.Bold)
            
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator() // Placeholder for actual compass canvas
                Text("מחשב כיוון...")
            }

            Divider()

            Button(onClick = { /* TODO Load Tefila */ }, modifier = Modifier.fillMaxWidth()) {
                Text("תפילת שחרית")
            }
            Button(onClick = { /* TODO Load Eizehu Mekoman */ }, modifier = Modifier.fillMaxWidth()) {
                Text("איזהו מקומן")
            }
            Button(onClick = { /* TODO Rabbeinu tam */ }, modifier = Modifier.fillMaxWidth()) {
                Text("רבינו תם - זמנים")
            }
        }
    }
}